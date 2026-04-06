import type { Express } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { metaClient } from "../services/meta";
import { storage } from "../storage";
import { ObjectId } from "mongodb";

export function setupMetaContentRoutes(app: Express) {
  
  /**
   * Get Facebook page data for current artist
   */
  app.get("/api/creators/facebook", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(404).json({ 
          message: "No Facebook page connected",
          hasPage: false
        });
      }

      res.json({
        success: true,
        hasPage: true,
        data: facebookConnection
      });
    } catch (error: any) {
      console.error("Error fetching Facebook data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get Facebook posts for current artist
   */
  app.get("/api/creators/facebook/posts", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 12 } = req.query;
      
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(404).json({ 
          message: "No Facebook page connected",
          hasPage: false
        });
      }

      // Check verification status
      if (facebookConnection.verificationStatus !== 'verified') {
        return res.status(403).json({
          message: "Facebook page not verified by admin",
          verificationStatus: facebookConnection.verificationStatus
        });
      }

      // Fetch posts from Facebook API
      const posts = await metaClient.getPagePosts(
        facebookConnection.pageId,
        facebookConnection.accessToken,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: posts
      });
    } catch (error: any) {
      console.error("Error fetching Facebook posts:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Facebook posts",
        success: false
      });
    }
  });

  /**
   * Get Facebook insights for current artist
   */
  app.get("/api/creators/facebook/insights", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(404).json({ message: "No Facebook page connected" });
      }

      if (facebookConnection.verificationStatus !== 'verified') {
        return res.status(403).json({ message: "Facebook page not verified" });
      }

      const insights = await metaClient.getPageInsights(
        facebookConnection.pageId,
        facebookConnection.accessToken
      );

      res.json({
        success: true,
        data: insights
      });
    } catch (error: any) {
      console.error("Error fetching Facebook insights:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Facebook insights",
        success: false
      });
    }
  });

  /**
   * Refresh Facebook page data
   */
  app.post("/api/creators/facebook/refresh", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(404).json({ message: "No Facebook page connected" });
      }

      // Clear cache
      metaClient.clearCache();
      console.log('🔄 Cache cleared, fetching fresh Facebook data...');

      // Get fresh data from Facebook API
      const pageDetails = await metaClient.getPageDetails(
        facebookConnection.pageId,
        facebookConnection.accessToken
      );

      // Update artist profile
      const db = await storage.db;
      await db.collection("users").updateOne(
        { _id: new ObjectId(req.user!.id) },
        {
          $set: {
            "artist.metaConnections.facebook": {
              ...facebookConnection,
              pageName: pageDetails.pageName,
              username: pageDetails.username,
              followersCount: pageDetails.followersCount,
              likesCount: pageDetails.likesCount,
              profilePicture: pageDetails.profilePicture,
              coverPhoto: pageDetails.coverPhoto,
              isVerified: pageDetails.isVerified,
              category: pageDetails.category,
              lastSyncedAt: new Date()
            }
          }
        }
      );

      console.log(`✅ Facebook data refreshed for ${artist.name}`);

      res.json({
        success: true,
        message: "Facebook data refreshed successfully",
        data: pageDetails
      });
    } catch (error: any) {
      console.error("Facebook refresh error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to refresh Facebook data",
        success: false
      });
    }
  });

  /**
   * Get Instagram account data for current artist
   */
  app.get("/api/creators/instagram", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const instagramConnection = (artist.artist as any)?.metaConnections?.instagram;
      if (!instagramConnection || !instagramConnection.connected) {
        return res.status(404).json({ 
          message: "No Instagram account connected",
          hasAccount: false
        });
      }

      res.json({
        success: true,
        hasAccount: true,
        data: instagramConnection
      });
    } catch (error: any) {
      console.error("Error fetching Instagram data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Get Instagram media for current artist
   */
  app.get("/api/creators/instagram/media", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 12 } = req.query;
      
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const instagramConnection = (artist.artist as any)?.metaConnections?.instagram;
      if (!instagramConnection || !instagramConnection.connected) {
        return res.status(404).json({ 
          message: "No Instagram account connected",
          hasAccount: false
        });
      }

      if (instagramConnection.verificationStatus !== 'verified') {
        return res.status(403).json({
          message: "Instagram account not verified by admin",
          verificationStatus: instagramConnection.verificationStatus
        });
      }

      // Fetch media from Instagram API
      const media = await metaClient.getInstagramMedia(
        instagramConnection.accountId,
        instagramConnection.accessToken,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: media
      });
    } catch (error: any) {
      console.error("Error fetching Instagram media:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Instagram media",
        success: false
      });
    }
  });

  /**
   * Get Instagram insights for current artist
   */
  app.get("/api/creators/instagram/insights", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const instagramConnection = (artist.artist as any)?.metaConnections?.instagram;
      if (!instagramConnection || !instagramConnection.connected) {
        return res.status(404).json({ message: "No Instagram account connected" });
      }

      if (instagramConnection.verificationStatus !== 'verified') {
        return res.status(403).json({ message: "Instagram account not verified" });
      }

      const insights = await metaClient.getInstagramInsights(
        instagramConnection.accountId,
        instagramConnection.accessToken
      );

      res.json({
        success: true,
        data: insights
      });
    } catch (error: any) {
      console.error("Error fetching Instagram insights:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Instagram insights",
        success: false
      });
    }
  });

  /**
   * Refresh Instagram account data
   */
  app.post("/api/creators/instagram/refresh", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const instagramConnection = (artist.artist as any)?.metaConnections?.instagram;
      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      
      if (!instagramConnection || !instagramConnection.connected) {
        return res.status(404).json({ message: "No Instagram account connected" });
      }

      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(400).json({ message: "Facebook page required for Instagram refresh" });
      }

      // Clear cache
      metaClient.clearCache();
      console.log('🔄 Cache cleared, fetching fresh Instagram data...');

      // Get fresh data from Instagram API
      const accountDetails = await metaClient.getInstagramAccount(
        facebookConnection.pageId,
        facebookConnection.accessToken
      );

      // Update artist profile
      const db = await storage.db;
      await db.collection("users").updateOne(
        { _id: new ObjectId(req.user!.id) },
        {
          $set: {
            "artist.metaConnections.instagram": {
              ...instagramConnection,
              username: accountDetails.username,
              followersCount: accountDetails.followersCount,
              followingCount: accountDetails.followingCount,
              mediaCount: accountDetails.mediaCount,
              profilePicture: accountDetails.profilePicture,
              biography: accountDetails.biography,
              website: accountDetails.website,
              lastSyncedAt: new Date()
            }
          }
        }
      );

      console.log(`✅ Instagram data refreshed for ${artist.name}`);

      res.json({
        success: true,
        message: "Instagram data refreshed successfully",
        data: accountDetails
      });
    } catch (error: any) {
      console.error("Instagram refresh error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to refresh Instagram data",
        success: false
      });
    }
  });

  /**
   * Get Facebook posts for any artist (public endpoint)
   */
  app.get("/api/artists/:artistId/facebook/posts", async (req, res) => {
    try {
      const { artistId } = req.params;
      const { limit = 6 } = req.query;
      
      const artist = await storage.getArtistByUserId(artistId);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const facebookConnection = (artist.artist as any)?.metaConnections?.facebook;
      if (!facebookConnection || !facebookConnection.connected) {
        return res.status(404).json({ 
          message: "No Facebook page connected",
          hasPage: false
        });
      }

      // Only show posts if verified
      if (facebookConnection.verificationStatus !== 'verified') {
        return res.status(404).json({ 
          message: "Facebook page not verified",
          hasPage: false
        });
      }

      const posts = await metaClient.getPagePosts(
        facebookConnection.pageId,
        facebookConnection.accessToken,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: posts
      });
    } catch (error: any) {
      console.error("Error fetching Facebook posts:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Facebook posts",
        success: false
      });
    }
  });

  /**
   * Get Instagram media for any artist (public endpoint)
   */
  app.get("/api/artists/:artistId/instagram/media", async (req, res) => {
    try {
      const { artistId } = req.params;
      const { limit = 6 } = req.query;
      
      const artist = await storage.getArtistByUserId(artistId);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const instagramConnection = (artist.artist as any)?.metaConnections?.instagram;
      if (!instagramConnection || !instagramConnection.connected) {
        return res.status(404).json({ 
          message: "No Instagram account connected",
          hasAccount: false
        });
      }

      // Only show media if verified
      if (instagramConnection.verificationStatus !== 'verified') {
        return res.status(404).json({ 
          message: "Instagram account not verified",
          hasAccount: false
        });
      }

      const media = await metaClient.getInstagramMedia(
        instagramConnection.accountId,
        instagramConnection.accessToken,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: media
      });
    } catch (error: any) {
      console.error("Error fetching Instagram media:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Instagram media",
        success: false
      });
    }
  });
}
