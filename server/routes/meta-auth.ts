import type { Express } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { metaClient } from "../services/meta";
import { storage } from "../storage";
import { ObjectId } from "mongodb";

export function setupMetaAuthRoutes(app: Express) {
  // Use main Meta app for OAuth (works for all users)
  const META_APP_ID = process.env.META_INSTAGRAM_APP_ID || '';
  const META_APP_SECRET = process.env.META_APP_SECRET || '';
  const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:5000/api/auth/meta/callback';

  console.log('🔧 Meta Auth Configuration:', {
    appId: META_APP_ID,
    redirectUri: META_REDIRECT_URI,
    note: 'Using META_APP_ID for OAuth (works for all users)'
  });

  /**
   * Initiate Facebook OAuth flow
   */
  app.get("/api/auth/meta/facebook/init", authenticateToken, requireRole(["artist"]), (req: AuthRequest, res) => {
    const state = Buffer.from(JSON.stringify({
      userId: req.user!.id,
      platform: 'facebook',
      timestamp: Date.now()
    })).toString('base64');

    // Request only approved permissions (no review needed)
    // Note: instagram_basic requires App Review - add it after approval
    const scopes = [
      'public_profile',           // Basic profile info
      'email',                    // Email address
      'pages_show_list',          // List pages user manages (REQUIRED for pages)
      'pages_read_engagement',     // Read page insights and posts (REQUIRED for content)
      'instagram_basic'        // Uncomment after App Review approval
    ].join(',');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
      `&state=${state}` +
      `&scope=${scopes}` +
      `&response_type=code`;

    res.json({ authUrl });
  });

  /**
   * Handle OAuth callback from Facebook
   */
  app.get("/api/auth/meta/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error('Meta OAuth error:', error, error_description);
        return res.redirect(`/creator?tab=settings&error=${error}`);
      }

      if (!code || !state) {
        return res.redirect('/creator?tab=settings&error=missing_params');
      }

      // Decode state
      const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { userId } = stateData;

      console.log('🔄 Starting Meta OAuth callback for user:', userId);

      // Exchange code for access token
      console.log('📝 Step 1: Exchanging code for token...');
      const tokenData = await metaClient.exchangeCodeForToken(code as string, META_REDIRECT_URI);
      console.log('✅ Token received');
      
      // Get long-lived token (60 days)
      console.log('📝 Step 2: Getting long-lived token...');
      const longLivedToken = await metaClient.getLongLivedToken(tokenData.access_token);
      console.log('✅ Long-lived token received, expires in:', longLivedToken.expires_in, 'seconds');

      // Get user from database
      console.log('📝 Step 3: Getting user from database...');
      const db = storage.db;
      const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      console.log('✅ User found:', {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      });

      // Get Facebook user profile
      console.log('📝 Step 4: Fetching Facebook user profile...');
      let facebookProfile = null;
      try {
        facebookProfile = await metaClient.getUserProfile(longLivedToken.access_token);
        console.log('✅ Facebook profile retrieved:', {
          id: facebookProfile.id,
          name: facebookProfile.name,
          email: facebookProfile.email || 'Not provided'
        });
      } catch (error: any) {
        console.log('⚠️  Could not fetch Facebook profile:', error.message);
        // Fallback to user data
        facebookProfile = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          picture: ''
        };
      }

      // Try to get user's Facebook pages
      let pages = [];
      let pageDetails = null;
      let instagramAccount = null;

      console.log('📝 Step 5: Checking for Facebook Pages...');
      try {
        pages = await metaClient.getUserPages(longLivedToken.access_token);
        console.log(`✅ Found ${pages.length} page(s)`);
        
        if (pages && pages.length > 0) {
          // Log all pages
          pages.forEach((page, index) => {
            console.log(`   Page ${index + 1}:`, {
              id: page.id,
              name: page.name,
              category: page.category,
              followers: page.followers_count || 0
            });
          });

          // Use the first page
          const selectedPage = pages[0];
          console.log('📝 Step 6: Fetching details for page:', selectedPage.name);
          
          pageDetails = await metaClient.getPageDetails(selectedPage.id, selectedPage.access_token);
          console.log('✅ Page details retrieved:', {
            pageId: pageDetails.pageId,
            pageName: pageDetails.pageName,
            followers: pageDetails.followersCount
          });
          
          // Try to get Instagram account
          console.log('📝 Step 7: Checking for Instagram account linked to page...');
          try {
            instagramAccount = await metaClient.getInstagramAccount(selectedPage.id, selectedPage.access_token);
            console.log('✅ Instagram account found:', {
              accountId: instagramAccount.accountId,
              username: instagramAccount.username,
              followers: instagramAccount.followersCount
            });
          } catch (error: any) {
            console.log('ℹ️  No Instagram account connected to this page:', error.message);
          }
        } else {
          console.log('ℹ️  No pages found - user doesn\'t manage any Facebook Pages');
        }
      } catch (error: any) {
        console.log('⚠️  Error fetching pages:', error.message);
      }

      // Update user's meta connections with profile data
      console.log('📝 Step 8: Saving to database...');
      const updateData: any = {
        "artist.metaConnections.facebookProfile": {
          connected: true,
          userId: facebookProfile.id,
          name: facebookProfile.name,
          email: facebookProfile.email,
          profilePicture: facebookProfile.picture || '',
          accessToken: longLivedToken.access_token,
          tokenExpiry: new Date(Date.now() + (longLivedToken.expires_in * 1000)),
          connectedAt: new Date(),
          lastSyncedAt: new Date()
        }
      };

      // If we have page data, add it
      if (pageDetails) {
        updateData["artist.metaConnections.facebook"] = {
          connected: true,
          pageId: pageDetails.pageId,
          pageName: pageDetails.pageName,
          username: pageDetails.username,
          about: pageDetails.about,
          category: pageDetails.category,
          followersCount: pageDetails.followersCount,
          likesCount: pageDetails.likesCount,
          profilePicture: pageDetails.profilePicture,
          coverPhoto: pageDetails.coverPhoto,
          isVerified: pageDetails.isVerified,
          verificationStatus: 'verified',
          website: pageDetails.website,
          email: pageDetails.email,
          phone: pageDetails.phone,
          pageLink: pageDetails.pageLink,
          accessToken: pages[0].access_token,
          tokenExpiry: new Date(Date.now() + (60 * 24 * 60 * 60 * 1000)),
          connectedAt: new Date(),
          lastSyncedAt: new Date()
        };
      }

      // If we have Instagram data, add it
      if (instagramAccount) {
        updateData["artist.metaConnections.instagram"] = {
          connected: true,
          accountId: instagramAccount.accountId,
          username: instagramAccount.username,
          name: instagramAccount.name,
          profilePicture: instagramAccount.profilePicture,
          followersCount: instagramAccount.followersCount,
          followingCount: instagramAccount.followingCount,
          mediaCount: instagramAccount.mediaCount,
          biography: instagramAccount.biography,
          website: instagramAccount.website,
          accountType: 'BUSINESS',
          verificationStatus: 'verified',
          accessToken: pages[0]?.access_token || longLivedToken.access_token,
          tokenExpiry: new Date(Date.now() + (60 * 24 * 60 * 60 * 1000)),
          connectedAt: new Date(),
          lastSyncedAt: new Date()
        };
      }

      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );

      console.log('✅ Database updated successfully');
      console.log('📊 Connection Summary:', {
        profile: facebookProfile.name,
        facebook: pageDetails?.pageName || 'No page',
        instagram: instagramAccount?.username || 'Not connected'
      });

      res.redirect('/creator?tab=settings&success=meta_connected');
    } catch (error: any) {
      console.error('❌ Meta callback error:', error);
      console.error('Error stack:', error.stack);
      res.redirect(`/creator?tab=settings&error=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * Disconnect Facebook
   */
  app.post("/api/auth/meta/facebook/disconnect", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const db = storage.db;
      await db.collection("users").updateOne(
        { _id: new ObjectId(req.user!.id) },
        {
          $unset: {
            "artist.metaConnections.facebook": ""
          }
        }
      );

      res.json({ success: true, message: "Facebook disconnected successfully" });
    } catch (error: any) {
      console.error('Error disconnecting Facebook:', error);
      res.status(500).json({ message: "Failed to disconnect Facebook" });
    }
  });

  /**
   * Disconnect Instagram
   */
  app.post("/api/auth/meta/instagram/disconnect", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const db = storage.db;
      await db.collection("users").updateOne(
        { _id: new ObjectId(req.user!.id) },
        {
          $unset: {
            "artist.metaConnections.instagram": ""
          }
        }
      );

      res.json({ success: true, message: "Instagram disconnected successfully" });
    } catch (error: any) {
      console.error('Error disconnecting Instagram:', error);
      res.status(500).json({ message: "Failed to disconnect Instagram" });
    }
  });

  /**
   * Get Meta connection status
   */
  app.get("/api/creators/meta/status", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const metaConnections = (artist.artist as any)?.metaConnections || {};

      res.json({
        profile: {
          connected: metaConnections.facebookProfile?.connected || false,
          name: metaConnections.facebookProfile?.name || null,
          email: metaConnections.facebookProfile?.email || null,
          profilePicture: metaConnections.facebookProfile?.profilePicture || null,
          profileLink: metaConnections.facebookProfile?.profileLink || null,
          ageRange: metaConnections.facebookProfile?.ageRange || null,
          birthday: metaConnections.facebookProfile?.birthday || null,
          gender: metaConnections.facebookProfile?.gender || null,
          locale: metaConnections.facebookProfile?.locale || null,
          timezone: metaConnections.facebookProfile?.timezone || null,
          isVerified: metaConnections.facebookProfile?.isVerified || false,
          friendsCount: metaConnections.facebookProfile?.friendsCount || null,
          likesCount: metaConnections.facebookProfile?.likesCount || null
        },
        facebook: {
          connected: metaConnections.facebook?.connected || false,
          pageName: metaConnections.facebook?.pageName || null,
          verificationStatus: metaConnections.facebook?.verificationStatus || null
        },
        instagram: {
          connected: metaConnections.instagram?.connected || false,
          username: metaConnections.instagram?.username || null,
          verificationStatus: metaConnections.instagram?.verificationStatus || null
        }
      });
    } catch (error: any) {
      console.error('Error getting Meta status:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
