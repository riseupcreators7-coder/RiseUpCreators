import axios from 'axios';

/**
 * YouTube Data API v3 Client
 * Handles all interactions with the YouTube Data API
 */
export class YouTubeClient {
  private apiKey: string;
  private baseUrl: string = 'https://www.googleapis.com/youtube/v3';
  private quotaUsed: number = 0;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheDuration: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  YouTube API key not configured');
    }
  }

  /**
   * Makes a request to the YouTube API with caching
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    try {
      const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
      
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`Cache hit for ${endpoint}`);
        return cached.data;
      }

      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params: {
          ...params,
          key: this.apiKey
        }
      });

      this.trackQuotaUsage(endpoint);

      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 403 && data.error?.errors?.[0]?.reason === 'quotaExceeded') {
          throw new Error('YouTube API quota exceeded. Please try again later.');
        }
        
        if (status === 403 && data.error?.errors?.[0]?.reason === 'rateLimitExceeded') {
          throw new Error('YouTube API rate limit exceeded. Please try again later.');
        }
        
        if (status === 400) {
          throw new Error(`Invalid YouTube API request: ${data.error?.message || 'Bad request'}`);
        }
        
        if (status === 404) {
          throw new Error('YouTube resource not found');
        }

        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      throw new Error(`Failed to connect to YouTube API: ${error.message}`);
    }
  }

  private trackQuotaUsage(endpoint: string): void {
    const quotaCosts: Record<string, number> = {
      'channels': 1,
      'videos': 1,
      'search': 100
    };

    const cost = quotaCosts[endpoint] || 1;
    this.quotaUsed += cost;
  }

  extractChannelId(url: string): string | null {
    if (url.startsWith('UC') && url.length === 24) {
      return url;
    }

    const patterns = [
      /youtube\.com\/channel\/(UC[\w-]{22})/,
      /youtube\.com\/c\/([\w-]+)/,
      /youtube\.com\/@([\w-]+)/,
      /youtube\.com\/user\/([\w-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async getChannelByUrl(channelUrl: string): Promise<any> {
    try {
      const identifier = this.extractChannelId(channelUrl);
      
      if (!identifier) {
        throw new Error('Invalid YouTube channel URL format');
      }

      if (identifier.startsWith('UC')) {
        return await this.getChannelById(identifier);
      }

      const data = await this.makeRequest('channels', {
        part: 'snippet,statistics,contentDetails,brandingSettings,status',
        forUsername: identifier
      });

      if (!data.items || data.items.length === 0) {
        const searchData = await this.makeRequest('search', {
          part: 'snippet',
          type: 'channel',
          q: identifier,
          maxResults: 1
        });

        if (!searchData.items || searchData.items.length === 0) {
          throw new Error('Channel not found');
        }

        const channelId = searchData.items[0].snippet.channelId;
        return await this.getChannelById(channelId);
      }

      return this.formatChannelData(data.items[0]);
    } catch (error: any) {
      console.error('Error getting channel by URL:', error.message);
      throw error;
    }
  }

  async getChannelById(channelId: string): Promise<any> {
    try {
      const data = await this.makeRequest('channels', {
        part: 'snippet,statistics,contentDetails,brandingSettings,status',
        id: channelId
      });

      if (!data.items || data.items.length === 0) {
        throw new Error('Channel not found');
      }

      return this.formatChannelData(data.items[0]);
    } catch (error: any) {
      console.error('Error getting channel by ID:', error.message);
      throw error;
    }
  }

  private formatChannelData(rawData: any): any {
    // Log the raw status data for debugging
    console.log('📊 YouTube Channel Raw Data:', {
      channelId: rawData.id,
      channelName: rawData.snippet.title,
      status: rawData.status,
      brandingSettings: rawData.brandingSettings,
      // Check all possible verification indicators
      isLinked: rawData.status?.isLinked,
      longUploadsStatus: rawData.status?.longUploadsStatus,
      madeForKids: rawData.status?.madeForKids
    });

    // YouTube verification is NOT available through the public API
    // The verification badge is only visible on the YouTube website
    // We should NOT show this badge as we cannot reliably detect it
    const isYouTubeVerified = false; // Always false since API doesn't provide this

    return {
      channelId: rawData.id,
      channelName: rawData.snippet.title,
      description: rawData.snippet.description || '',
      customUrl: rawData.snippet.customUrl || '',
      subscriberCount: parseInt(rawData.statistics.subscriberCount) || 0,
      videoCount: parseInt(rawData.statistics.videoCount) || 0,
      viewCount: parseInt(rawData.statistics.viewCount) || 0,
      thumbnails: {
        default: rawData.snippet.thumbnails.default?.url || '',
        medium: rawData.snippet.thumbnails.medium?.url || '',
        high: rawData.snippet.thumbnails.high?.url || ''
      },
      country: rawData.snippet.country || '',
      publishedAt: new Date(rawData.snippet.publishedAt),
      // YouTube Official Verification Badge - NOT AVAILABLE via API
      isYouTubeVerified: isYouTubeVerified,
      madeForKids: rawData.status?.madeForKids || false
    };
  }

  /**
   * Gets latest videos from a channel
   */
  async getChannelVideos(channelId: string, maxResults: number = 12): Promise<any[]> {
    try {
      // Get uploads playlist ID
      const channelData = await this.makeRequest('channels', {
        part: 'contentDetails',
        id: channelId
      });

      if (!channelData.items || channelData.items.length === 0) {
        throw new Error('Channel not found');
      }

      const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

      // Get videos from uploads playlist
      const playlistData = await this.makeRequest('playlistItems', {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: Math.min(maxResults, 50)
      });

      if (!playlistData.items || playlistData.items.length === 0) {
        return [];
      }

      const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId);

      // Get detailed video information
      return await this.getVideoDetails(videoIds);
    } catch (error: any) {
      console.error('Error getting channel videos:', error.message);
      throw error;
    }
  }

  /**
   * Gets detailed information for multiple videos (batch request)
   */
  async getVideoDetails(videoIds: string[]): Promise<any[]> {
    try {
      if (!videoIds || videoIds.length === 0) {
        return [];
      }

      // YouTube API allows up to 50 IDs per request
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < videoIds.length; i += batchSize) {
        batches.push(videoIds.slice(i, i + batchSize));
      }

      const allVideos = [];

      for (const batch of batches) {
        const data = await this.makeRequest('videos', {
          part: 'snippet,statistics,contentDetails',
          id: batch.join(',')
        });

        if (data.items && data.items.length > 0) {
          const formattedVideos = data.items.map((video: any) => this.formatVideoData(video));
          allVideos.push(...formattedVideos);
        }
      }

      return allVideos;
    } catch (error: any) {
      console.error('Error getting video details:', error.message);
      throw error;
    }
  }

  /**
   * Formats raw video data from YouTube API
   */
  private formatVideoData(rawData: any): any {
    return {
      videoId: rawData.id,
      channelId: rawData.snippet.channelId,
      title: rawData.snippet.title,
      description: rawData.snippet.description || '',
      thumbnails: {
        default: rawData.snippet.thumbnails.default?.url || '',
        medium: rawData.snippet.thumbnails.medium?.url || '',
        high: rawData.snippet.thumbnails.high?.url || '',
        maxres: rawData.snippet.thumbnails.maxres?.url || rawData.snippet.thumbnails.high?.url || ''
      },
      publishedAt: new Date(rawData.snippet.publishedAt),
      duration: rawData.contentDetails.duration,
      viewCount: parseInt(rawData.statistics.viewCount) || 0,
      likeCount: parseInt(rawData.statistics.likeCount) || 0,
      commentCount: parseInt(rawData.statistics.commentCount) || 0,
      tags: rawData.snippet.tags || [],
      categoryId: rawData.snippet.categoryId || ''
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('API response cache cleared');
  }
}

export const youtubeClient = new YouTubeClient();
