import type { Express } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { metaClient } from "../services/meta";

export function setupAdminMetaRoutes(app: Express) {
  
  /**
   * Get platform-wide Meta overview stats
   */
  app.get("/api/admin/meta/overview", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const db = storage.db;
      
      // Get all users with Meta connections
      const users = await db.collection("users").find({
        "artist.metaConnections": { $exists: true }
      }).toArray();

      let totalFacebookPages = 0;
      let totalInstagramAccounts = 0;
      let totalFacebookFollowers = 0;
      let totalInstagramFollowers = 0;
      let totalFacebookPosts = 0;
      let totalInstagramPosts = 0;

      users.forEach((user: any) => {
        const meta = user.artist?.metaConnections;
        
        if (meta?.facebook?.connected) {
          totalFacebookPages++;
          totalFacebookFollowers += meta.facebook.followersCount || 0;
        }
        
        if (meta?.instagram?.connected) {
          totalInstagramAccounts++;
          totalInstagramFollowers += meta.instagram.followersCount || 0;
          totalInstagramPosts += meta.instagram.mediaCount || 0;
        }
      });

      res.json({
        success: true,
        data: {
          totalArtistsConnected: users.length,
          facebook: {
            totalPages: totalFacebookPages,
            totalFollowers: totalFacebookFollowers,
            totalPosts: totalFacebookPosts,
            avgFollowersPerPage: totalFacebookPages > 0 ? Math.round(totalFacebookFollowers / totalFacebookPages) : 0
          },
          instagram: {
            totalAccounts: totalInstagramAccounts,
            totalFollowers: totalInstagramFollowers,
            totalPosts: totalInstagramPosts,
            avgFollowersPerAccount: totalInstagramAccounts > 0 ? Math.round(totalInstagramFollowers / totalInstagramAccounts) : 0
          }
        }
      });
    } catch (error: any) {
      console.error("Error fetching Meta overview:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get all artists with Meta connections
   */
  app.get("/api/admin/meta/artists", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { page = 1, limit = 20, sortBy = 'followers', platform = 'all' } = req.query;
      
      const db = storage.db;
      
      // Build query based on platform filter
      let query: any = { "artist.metaConnections": { $exists: true } };
      
      if (platform === 'facebook') {
        query["artist.metaConnections.facebook.connected"] = true;
      } else if (platform === 'instagram') {
        query["artist.metaConnections.instagram.connected"] = true;
      }

      const users = await db.collection("users").find(query).toArray();

      // Format and enrich data
      const artists = users.map((user: any) => {
        const meta = user.artist?.metaConnections;
        const facebook = meta?.facebook;
        const instagram = meta?.instagram;

        return {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          artistName: user.artist?.name || user.name,
          facebook: facebook?.connected ? {
            pageId: facebook.pageId,
            pageName: facebook.pageName,
            pageLink: facebook.pageLink || `https://www.facebook.com/${facebook.pageId}`,
            followersCount: facebook.followersCount || 0,
            likesCount: facebook.likesCount || 0,
            isVerified: facebook.isVerified || false,
            connectedAt: facebook.connectedAt,
            lastSyncedAt: facebook.lastSyncedAt
          } : null,
          instagram: instagram?.connected ? {
            username: instagram.username,
            followersCount: instagram.followersCount || 0,
            followingCount: instagram.followingCount || 0,
            mediaCount: instagram.mediaCount || 0,
            connectedAt: instagram.connectedAt,
            lastSyncedAt: instagram.lastSyncedAt
          } : null,
          totalFollowers: (facebook?.followersCount || 0) + (instagram?.followersCount || 0)
        };
      });

      // Sort artists
      artists.sort((a, b) => {
        if (sortBy === 'followers') {
          return b.totalFollowers - a.totalFollowers;
        } else if (sortBy === 'name') {
          return a.artistName.localeCompare(b.artistName);
        } else if (sortBy === 'recent') {
          const aDate = Math.max(
            new Date(a.facebook?.connectedAt || 0).getTime(),
            new Date(a.instagram?.connectedAt || 0).getTime()
          );
          const bDate = Math.max(
            new Date(b.facebook?.connectedAt || 0).getTime(),
            new Date(b.instagram?.connectedAt || 0).getTime()
          );
          return bDate - aDate;
        }
        return 0;
      });

      // Paginate
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedArtists = artists.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedArtists,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: artists.length,
          totalPages: Math.ceil(artists.length / Number(limit))
        }
      });
    } catch (error: any) {
      console.error("Error fetching Meta artists:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get top performing artists by engagement
   */
  app.get("/api/admin/meta/top-artists", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 10, platform = 'all' } = req.query;
      
      const db = storage.db;
      
      const users = await db.collection("users").find({
        "artist.metaConnections": { $exists: true }
      }).toArray();

      const artists = users.map((user: any) => {
        const meta = user.artist?.metaConnections;
        const facebook = meta?.facebook;
        const instagram = meta?.instagram;

        let totalFollowers = 0;
        let totalEngagement = 0;

        if (platform === 'all' || platform === 'facebook') {
          if (facebook?.connected) {
            totalFollowers += facebook.followersCount || 0;
            totalEngagement += (facebook.followersCount || 0) + (facebook.likesCount || 0);
          }
        }

        if (platform === 'all' || platform === 'instagram') {
          if (instagram?.connected) {
            totalFollowers += instagram.followersCount || 0;
            totalEngagement += (instagram.followersCount || 0) + (instagram.mediaCount || 0) * 10;
          }
        }

        return {
          userId: user._id.toString(),
          artistName: user.artist?.name || user.name,
          totalFollowers,
          totalEngagement,
          facebook: facebook?.connected ? {
            pageId: facebook.pageId,
            pageName: facebook.pageName,
            pageLink: facebook.pageLink || `https://www.facebook.com/${facebook.pageId}`,
            followers: facebook.followersCount || 0
          } : null,
          instagram: instagram?.connected ? {
            username: instagram.username,
            followers: instagram.followersCount || 0
          } : null
        };
      });

      // Sort by engagement and limit
      artists.sort((a, b) => b.totalEngagement - a.totalEngagement);
      const topArtists = artists.slice(0, Number(limit));

      res.json({
        success: true,
        data: topArtists
      });
    } catch (error: any) {
      console.error("Error fetching top artists:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get Meta connection trends over time
   */
  app.get("/api/admin/meta/trends", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { days = 30 } = req.query;
      
      const db = storage.db;
      
      const users = await db.collection("users").find({
        "artist.metaConnections": { $exists: true }
      }).toArray();

      // Group connections by date
      const trends: any = {};
      const now = new Date();
      const daysAgo = Number(days);

      // Initialize all dates
      for (let i = 0; i < daysAgo; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        trends[dateKey] = {
          date: dateKey,
          facebookConnections: 0,
          instagramConnections: 0,
          totalConnections: 0
        };
      }

      // Count connections by date
      users.forEach((user: any) => {
        const meta = user.artist?.metaConnections;
        
        if (meta?.facebook?.connectedAt) {
          const dateKey = new Date(meta.facebook.connectedAt).toISOString().split('T')[0];
          if (trends[dateKey]) {
            trends[dateKey].facebookConnections++;
            trends[dateKey].totalConnections++;
          }
        }
        
        if (meta?.instagram?.connectedAt) {
          const dateKey = new Date(meta.instagram.connectedAt).toISOString().split('T')[0];
          if (trends[dateKey]) {
            trends[dateKey].instagramConnections++;
            trends[dateKey].totalConnections++;
          }
        }
      });

      // Convert to array and sort by date
      const trendsArray = Object.values(trends).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      res.json({
        success: true,
        data: trendsArray
      });
    } catch (error: any) {
      console.error("Error fetching Meta trends:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get detailed stats for a specific artist
   */
  app.get("/api/admin/meta/artist/:userId", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      
      const db = storage.db;
      const user = await db.collection("users").findOne({ _id: userId as any });

      if (!user) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const meta = (user as any).artist?.metaConnections;

      res.json({
        success: true,
        data: {
          userId: user._id.toString(),
          name: (user as any).name,
          artistName: (user as any).artist?.name || (user as any).name,
          facebook: meta?.facebook || null,
          instagram: meta?.instagram || null,
          facebookProfile: meta?.facebookProfile || null
        }
      });
    } catch (error: any) {
      console.error("Error fetching artist Meta details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get recent posts from all artists for moderation
   */
  app.get("/api/admin/meta/content/recent", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { platform = 'all', limit = 50, days = 7 } = req.query;
      
      console.log('🔍 Fetching content for moderation:', { platform, limit, days });
      
      const db = storage.db;
      
      // Get all users with Meta connections
      const users = await db.collection("users").find({
        "artist.metaConnections": { $exists: true }
      }).toArray();

      console.log(`📊 Found ${users.length} users with Meta connections`);

      const allContent: any[] = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));
      console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

      // Fetch posts from each artist
      for (const user of users) {
        const meta = (user as any).artist?.metaConnections;
        const artistInfo = {
          userId: user._id.toString(),
          artistName: (user as any).artist?.name || (user as any).name,
          email: (user as any).email
        };

        console.log(`\n👤 Processing artist: ${artistInfo.artistName}`);

        // Fetch Facebook posts
        if ((platform === 'all' || platform === 'facebook') && meta?.facebook?.connected) {
          try {
            console.log(`  📘 Fetching Facebook posts for ${artistInfo.artistName}...`);
            const posts = await metaClient.getPagePosts(
              meta.facebook.pageId,
              meta.facebook.accessToken,
              10
            );

            console.log(`  ✅ Found ${posts.length} Facebook posts`);

            let addedCount = 0;
            posts.forEach((post: any) => {
              if (new Date(post.createdTime) >= cutoffDate) {
                allContent.push({
                  ...post,
                  platform: 'facebook',
                  artist: artistInfo,
                  pageLink: meta.facebook.pageLink
                });
                addedCount++;
              }
            });
            console.log(`  ➕ Added ${addedCount} posts within date range`);
          } catch (error: any) {
            console.log(`  ❌ Failed to fetch Facebook posts for ${artistInfo.artistName}:`, error.message);
          }
        }

        // Fetch Instagram posts
        if ((platform === 'all' || platform === 'instagram') && meta?.instagram?.connected) {
          try {
            console.log(`  📷 Fetching Instagram media for ${artistInfo.artistName}...`);
            const media = await metaClient.getInstagramMedia(
              meta.instagram.accountId,
              meta.instagram.accessToken,
              10
            );

            console.log(`  ✅ Found ${media.length} Instagram posts`);

            let addedCount = 0;
            media.forEach((item: any) => {
              if (new Date(item.timestamp) >= cutoffDate) {
                allContent.push({
                  postId: item.mediaId,
                  message: item.caption,
                  createdTime: item.timestamp,
                  image: item.mediaUrl,
                  type: item.mediaType,
                  permalink: item.permalink,
                  likes: item.likes,
                  comments: item.comments,
                  engagement: item.engagement,
                  platform: 'instagram',
                  artist: artistInfo,
                  username: meta.instagram.username
                });
                addedCount++;
              }
            });
            console.log(`  ➕ Added ${addedCount} posts within date range`);
          } catch (error: any) {
            console.log(`  ❌ Failed to fetch Instagram media for ${artistInfo.artistName}:`, error.message);
          }
        }
      }

      // Sort by date (newest first)
      allContent.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

      // Limit results
      const limitedContent = allContent.slice(0, Number(limit));

      console.log(`\n📦 Total content collected: ${allContent.length}`);
      console.log(`📤 Returning ${limitedContent.length} items (limited to ${limit})`);

      res.json({
        success: true,
        data: limitedContent,
        total: allContent.length
      });
    } catch (error: any) {
      console.error("❌ Error fetching content for moderation:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  /**
   * Get moderation stats
   */
  app.get("/api/admin/meta/content/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const db = storage.db;
      
      // Get moderation records
      const moderationRecords = await db.collection("content_moderation").find({}).toArray();

      const stats = {
        total: moderationRecords.length,
        pending: moderationRecords.filter((r: any) => r.status === 'pending').length,
        approved: moderationRecords.filter((r: any) => r.status === 'approved').length,
        rejected: moderationRecords.filter((r: any) => r.status === 'rejected').length,
        flagged: moderationRecords.filter((r: any) => r.status === 'flagged').length
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error("Error fetching moderation stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Moderate content (approve/reject/flag)
   */
  app.post("/api/admin/meta/content/moderate", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { postId, platform, action, notes, artistUserId } = req.body;

      if (!postId || !platform || !action) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!['approve', 'reject', 'flag'].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const db = storage.db;

      // Create or update moderation record
      const moderationRecord = {
        postId,
        platform,
        artistUserId,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged',
        notes: notes || '',
        moderatedBy: req.user!.id,
        moderatedAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("content_moderation").updateOne(
        { postId, platform },
        { $set: moderationRecord },
        { upsert: true }
      );

      res.json({
        success: true,
        message: `Content ${action}ed successfully`
      });
    } catch (error: any) {
      console.error("Error moderating content:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get moderation status for specific posts
   */
  app.post("/api/admin/meta/content/status", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { postIds } = req.body;

      if (!postIds || !Array.isArray(postIds)) {
        return res.status(400).json({ message: "Invalid postIds" });
      }

      const db = storage.db;
      const records = await db.collection("content_moderation").find({
        postId: { $in: postIds }
      }).toArray();

      // Create a map of postId -> status
      const statusMap: any = {};
      records.forEach((record: any) => {
        statusMap[record.postId] = {
          status: record.status,
          notes: record.notes,
          moderatedAt: record.moderatedAt
        };
      });

      res.json({
        success: true,
        data: statusMap
      });
    } catch (error: any) {
      console.error("Error fetching moderation status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
