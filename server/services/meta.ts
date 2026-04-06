import axios from 'axios';

/**
 * Meta Graph API Client
 * Handles interactions with Facebook and Instagram Graph APIs
 */
export class MetaClient {
  private appId: string;
  private appSecret: string;
  private baseUrl: string = 'https://graph.facebook.com/v18.0';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheDuration: number = 1800000; // 30 minutes

  constructor(appId?: string, appSecret?: string) {
    // Use Instagram app credentials by default (has approved permissions)
    this.appId = appId || process.env.META_INSTAGRAM_APP_ID || '';
    this.appSecret = appSecret || process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '';
    
    if (!this.appId || !this.appSecret) {
      console.warn('⚠️  Meta API credentials not configured');
    } else {
      console.log('✅ Meta API configured with App ID:', this.appId);
    }
  }

  /**
   * Makes a request to Meta Graph API with caching and retry logic
   */
  private async makeRequest(
    endpoint: string, 
    accessToken: string,
    params: Record<string, any> = {},
    retryCount = 0
  ): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
    
    try {
      const cacheKey = `${endpoint}:${JSON.stringify(params)}:${accessToken.substring(0, 10)}`;
      
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`✅ Cache hit for ${endpoint}`);
        return cached.data;
      }

      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params: {
          ...params,
          access_token: accessToken
        },
        timeout: 10000 // 10 second timeout
      });

      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error: any) {
      // Check if it's a network error that can be retried
      const isNetworkError = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('socket disconnected') ||
        error.message?.includes('network') ||
        error.message?.includes('timeout');
      
      // Retry on network errors
      if (isNetworkError && retryCount < maxRetries) {
        console.log(`⚠️  Network error on attempt ${retryCount + 1}/${maxRetries + 1}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.makeRequest(endpoint, accessToken, params, retryCount + 1);
      }
      
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 400) {
          throw new Error(`Invalid Meta API request: ${data.error?.message || 'Bad request'}`);
        }
        
        if (status === 401 || status === 403) {
          throw new Error('Meta access token expired or invalid. Please reconnect your account.');
        }
        
        if (status === 190) {
          throw new Error('Meta access token expired. Please reconnect your account.');
        }

        throw new Error(`Meta API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      // If we've exhausted retries or it's not a network error
      if (isNetworkError) {
        throw new Error('Unable to connect to Meta API. Please check your internet connection and try again later.');
      }
      
      throw new Error(`Failed to connect to Meta API: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    console.log('Exchanging code for token...', { code, redirectUri });
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: redirectUri,
          code: code
        }
      });
      console.log('Token exchange successful:', response.data);   
      return response.data;
    } catch (error: any) {
      console.error('Error in exchangeCodeForToken:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Get long-lived access token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Error getting long-lived token:', error.response?.data || error.message);
      throw new Error('Failed to get long-lived access token');
    }
  }

  /**
   * Get basic user profile information
   * Works with user access tokens (not page access tokens)
   */
  async getUserProfile(userAccessToken: string): Promise<any> {
    try {
      // Request basic profile fields that work with user access tokens
      const data = await this.makeRequest('me', userAccessToken, {
        fields: 'id,name,email,picture{url}'
      });

      return {
        id: data.id,
        name: data.name,
        email: data.email || '',
        picture: data.picture?.data?.url || ''
      };
    } catch (error: any) {
      console.error('❌ Error getting user profile:', error.message);
      if (error.response?.data) {
        console.error('API Error details:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get Facebook Pages managed by user
   */
  async getUserPages(userAccessToken: string): Promise<any[]> {
    try {
      console.log('🔍 Fetching user pages...');
      
      const data = await this.makeRequest('me/accounts', userAccessToken, {
        fields: 'id,name,access_token,category,followers_count,fan_count,picture,cover,is_verified'
      });

      const pages = data.data || [];
      console.log(`📊 API returned ${pages.length} page(s)`);
      
      if (pages.length > 0) {
        pages.forEach((page: any, index: number) => {
          console.log(`   Page ${index + 1}:`, {
            id: page.id,
            name: page.name,
            category: page.category,
            hasAccessToken: !!page.access_token
          });
        });
      }

      return pages;
    } catch (error: any) {
      console.error('❌ Error getting user pages:', error.message);
      if (error.response?.data) {
        console.error('API Error details:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get Facebook Page details
   */
  async getPageDetails(pageId: string, pageAccessToken: string): Promise<any> {
    try {
      const data = await this.makeRequest(pageId, pageAccessToken, {
        fields: 'id,name,username,about,category,followers_count,fan_count,picture{url},cover{source},is_verified,verification_status,website,emails,phone,location,link'
      });

      return this.formatPageData(data);
    } catch (error: any) {
      console.error('Error getting page details:', error.message);
      throw error;
    }
  }

  /**
   * Get Facebook Page posts
   */
  async getPagePosts(pageId: string, pageAccessToken: string, limit: number = 12): Promise<any[]> {
    try {
      // Try to fetch posts with attachments in a single call
      // Use a simpler attachments field structure
      console.log('📝 Fetching posts with attachments...');
      
      const data = await this.makeRequest(`${pageId}/published_posts`, pageAccessToken, {
        fields: 'id,message,created_time,permalink_url,full_picture',
        limit: limit
      });

      console.log(`✅ Fetched ${data.data?.length || 0} posts`);
      
      const formatted = (data.data || []).map((post: any, index: number) => {
        console.log(`\n📊 Post ${index + 1}:`, {
          id: post.id,
          hasFullPicture: !!post.full_picture,
          full_picture: post.full_picture
        });
        return this.formatPostData(post);
      });

      return formatted;
    } catch (error: any) {
      console.error('Error getting page posts:', error.message);
      
      // Fallback: try without full_picture
      if (error.message.includes('deprecate')) {
        console.log('⚠️  full_picture deprecated, trying without images...');
        const data = await this.makeRequest(`${pageId}/published_posts`, pageAccessToken, {
          fields: 'id,message,created_time,permalink_url',
          limit: limit
        });
        return (data.data || []).map((post: any) => this.formatPostData(post));
      }
      
      throw error;
    }
  }

  /**
   * Get Facebook Page insights
   */
  async getPageInsights(pageId: string, pageAccessToken: string): Promise<any> {
    try {
      const data = await this.makeRequest(`${pageId}/insights`, pageAccessToken, {
        metric: 'page_impressions,page_engaged_users,page_post_engagements,page_fans,page_views_total',
        period: 'day',
        date_preset: 'last_30d'
      });

      return this.formatInsightsData(data.data || []);
    } catch (error: any) {
      console.error('Error getting page insights:', error.message);
      return null; // Insights might not be available for all pages
    }
  }

  /**
   * Get Instagram Business Account connected to Facebook Page
   */
  async getInstagramAccount(pageId: string, pageAccessToken: string): Promise<any> {
    try {
      console.log('🔍 Fetching Instagram account for page:', pageId);
      
      const data = await this.makeRequest(pageId, pageAccessToken, {
        fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}'
      });

      console.log('📊 Page data received:', {
        hasInstagram: !!data.instagram_business_account,
        pageId: data.id
      });

      if (!data.instagram_business_account) {
        throw new Error('No Instagram Business account connected to this Facebook Page');
      }

      const igData = this.formatInstagramAccountData(data.instagram_business_account);
      console.log('✅ Instagram account formatted:', {
        accountId: igData.accountId,
        username: igData.username,
        followers: igData.followersCount
      });

      return igData;
    } catch (error: any) {
      console.error('❌ Error getting Instagram account:', error.message);
      if (error.response?.data) {
        console.error('API Error details:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get Instagram accounts using me/instagram_accounts endpoint
   * This is an alternative method that works with instagram_basic permission
   */
  async getInstagramAccounts(userAccessToken: string): Promise<any[]> {
    try {
      console.log('🔍 Fetching Instagram accounts via me/instagram_accounts...');
      
      const data = await this.makeRequest('me/instagram_accounts', userAccessToken, {
        fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website,is_published,has_profile_pic'
      });

      const accounts = data.data || [];
      console.log(`📊 Found ${accounts.length} Instagram account(s)`);
      
      if (accounts.length > 0) {
        accounts.forEach((account: any, index: number) => {
          console.log(`   Account ${index + 1}:`, {
            id: account.id,
            username: account.username,
            followers: account.followers_count
          });
        });
      }

      return accounts.map((account: any) => this.formatInstagramAccountData(account));
    } catch (error: any) {
      console.error('❌ Error getting Instagram accounts:', error.message);
      if (error.response?.data) {
        console.error('API Error details:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get Instagram media (posts)
   */
  async getInstagramMedia(instagramAccountId: string, accessToken: string, limit: number = 12): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${instagramAccountId}/media`, accessToken, {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit: limit
      });

      return (data.data || []).map((media: any) => this.formatInstagramMediaData(media));
    } catch (error: any) {
      console.error('Error getting Instagram media:', error.message);
      throw error;
    }
  }

  /**
   * Get Instagram insights
   */
  async getInstagramInsights(instagramAccountId: string, accessToken: string): Promise<any> {
    try {
      const data = await this.makeRequest(`${instagramAccountId}/insights`, accessToken, {
        metric: 'impressions,reach,profile_views,follower_count',
        period: 'day',
        since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        until: Math.floor(Date.now() / 1000)
      });

      return this.formatInstagramInsightsData(data.data || []);
    } catch (error: any) {
      console.error('Error getting Instagram insights:', error.message);
      return null;
    }
  }

  // Formatting methods
  private formatPageData(rawData: any): any {
    return {
      pageId: rawData.id,
      pageName: rawData.name,
      username: rawData.username || '',
      about: rawData.about || '',
      category: rawData.category || '',
      followersCount: rawData.followers_count || 0,
      likesCount: rawData.fan_count || 0,
      profilePicture: rawData.picture?.data?.url || rawData.picture?.url || '',
      coverPhoto: rawData.cover?.source || '',
      isVerified: rawData.is_verified || false,
      verificationStatus: rawData.verification_status || 'not_verified',
      website: rawData.website || '',
      email: rawData.emails?.[0] || '',
      phone: rawData.phone || '',
      location: rawData.location || null,
      pageLink: rawData.link || `https://www.facebook.com/${rawData.id}`
    };
  }

  private formatPostData(rawData: any): any {
    // Try to get image from full_picture field
    let image = rawData.full_picture || null;
    
    console.log('🔍 Formatting post:', {
      id: rawData.id,
      hasFullPicture: !!rawData.full_picture,
      hasAttachments: !!rawData.attachments
    });

    return {
      postId: rawData.id,
      message: rawData.message || rawData.story || '',
      createdTime: new Date(rawData.created_time),
      image: image,
      type: rawData.type || 'status',
      permalink: rawData.permalink_url || '',
      likes: rawData.reactions?.summary?.total_count || 0,
      comments: rawData.comments?.summary?.total_count || 0,
      shares: rawData.shares?.count || 0,
      engagement: (rawData.reactions?.summary?.total_count || 0) + 
                 (rawData.comments?.summary?.total_count || 0) + 
                 (rawData.shares?.count || 0)
    };
  }

  private formatInsightsData(rawData: any[]): any {
    const insights: any = {};
    
    rawData.forEach((metric: any) => {
      const name = metric.name;
      const values = metric.values || [];
      const total = values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
      
      insights[name] = {
        total,
        values: values.map((v: any) => ({
          value: v.value || 0,
          endTime: v.end_time
        }))
      };
    });

    return insights;
  }

  private formatInstagramAccountData(rawData: any): any {
    return {
      accountId: rawData.id,
      username: rawData.username || '',
      name: rawData.name || '',
      profilePicture: rawData.profile_picture_url || '',
      followersCount: rawData.followers_count || 0,
      followingCount: rawData.follows_count || 0,
      mediaCount: rawData.media_count || 0,
      biography: rawData.biography || '',
      website: rawData.website || ''
    };
  }

  private formatInstagramMediaData(rawData: any): any {
    return {
      mediaId: rawData.id,
      caption: rawData.caption || '',
      mediaType: rawData.media_type || 'IMAGE',
      mediaUrl: rawData.media_url || '',
      thumbnailUrl: rawData.thumbnail_url || rawData.media_url || '',
      permalink: rawData.permalink || '',
      timestamp: new Date(rawData.timestamp),
      likes: rawData.like_count || 0,
      comments: rawData.comments_count || 0,
      impressions: 0, // Insights require additional permissions
      reach: 0,
      engagement: (rawData.like_count || 0) + (rawData.comments_count || 0)
    };
  }

  private formatInstagramInsightsData(rawData: any[]): any {
    const insights: any = {};
    
    rawData.forEach((metric: any) => {
      insights[metric.name] = {
        total: metric.values?.reduce((sum: number, v: any) => sum + (v.value || 0), 0) || 0,
        values: metric.values || []
      };
    });

    return insights;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️  Meta API cache cleared');
  }
}

export const metaClient = new MetaClient();
