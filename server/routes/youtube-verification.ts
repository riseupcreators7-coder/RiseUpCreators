import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { youtubeClient } from "../services/youtube";
import { ObjectId } from "mongodb";

// Database connection helper
async function getDb() {
  return storage.db;
}

export function setupYouTubeVerificationRoutes(app: Express) {
  
  // Submit YouTube channel for verification (Artist)
  app.post("/api/creators/youtube/submit-verification", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const { channelUrl } = req.body;

      if (!channelUrl || typeof channelUrl !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: "YouTube channel URL is required" 
        });
      }

      // Fetch channel data from YouTube API
      const channelData = await youtubeClient.getChannelByUrl(channelUrl);

      // Check if channel is already verified by another artist
      const db = await getDb();
      const existingClaim = await db.collection("users").findOne({
        "artist.youtubeChannel.channelId": channelData.channelId,
        "artist.youtubeChannel.verificationStatus": "verified",
        _id: { $ne: new ObjectId(req.user!.id) }
      });

      if (existingClaim) {
        return res.status(409).json({
          success: false,
          message: `This YouTube channel is already verified by ${existingClaim.name}`,
          alreadyClaimed: true
        });
      }

      // Check if artist already has a pending request for this channel
      const existingRequest = await db.collection("youtubeVerificationRequests").findOne({
        artistId: new ObjectId(req.user!.id),
        channelId: channelData.channelId,
        status: "pending"
      });

      if (existingRequest) {
        return res.status(409).json({
          success: false,
          message: "You already have a pending verification request for this channel",
          pending: true
        });
      }

      // Get current artist profile
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ 
          success: false,
          message: "Artist profile not found" 
        });
      }

      // Rate limiting: Max 3 requests per day
      const recentRequests = await db.collection("youtubeVerificationRequests").countDocuments({
        artistId: new ObjectId(req.user!.id),
        submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (recentRequests >= 3) {
        return res.status(429).json({
          success: false,
          message: "Too many verification requests. Please try again tomorrow."
        });
      }

      // Create verification request
      const verificationRequest = await db.collection("youtubeVerificationRequests").insertOne({
        artistId: new ObjectId(req.user!.id),
        artistName: artist.name,
        artistEmail: artist.email,
        channelId: channelData.channelId,
        channelName: channelData.channelName,
        channelUrl: channelUrl,
        customUrl: channelData.customUrl,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        thumbnails: channelData.thumbnails,
        description: channelData.description,
        country: channelData.country,
        status: "pending",
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null
      });

      // Update artist profile with pending status
      await db.collection("users").updateOne(
        { _id: new ObjectId(req.user!.id) },
        {
          $set: {
            "artist.youtubeChannel": {
              channelId: channelData.channelId,
              channelName: channelData.channelName,
              channelUrl: channelUrl,
              customUrl: channelData.customUrl,
              subscriberCount: channelData.subscriberCount,
              videoCount: channelData.videoCount,
              viewCount: channelData.viewCount,
              thumbnails: channelData.thumbnails,
              description: channelData.description,
              country: channelData.country,
              verificationStatus: "pending",
              verificationRequestId: verificationRequest.insertedId,
              submittedAt: new Date(),
              lastSyncedAt: new Date()
            }
          }
        }
      );

      console.log(`📝 YouTube verification request submitted: ${artist.name} → ${channelData.channelName}`);

      res.status(202).json({
        success: true,
        message: "Your YouTube channel has been submitted for verification. Our team will review it within 24-48 hours and notify you via email.",
        pending: true,
        verificationStatus: "pending",
        estimatedReviewTime: "24-48 hours",
        requestId: verificationRequest.insertedId,
        data: {
          channelId: channelData.channelId,
          channelName: channelData.channelName,
          subscriberCount: channelData.subscriberCount,
          videoCount: channelData.videoCount,
          viewCount: channelData.viewCount,
          thumbnails: channelData.thumbnails
        }
      });
    } catch (error: any) {
      console.error("YouTube verification submission error:", error.message);
      res.status(400).json({ 
        success: false,
        message: error.message || "Failed to submit verification request" 
      });
    }
  });

  // Get verification status (Artist)
  app.get("/api/creators/youtube/verification-status", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const youtubeChannel = (artist.artist as any)?.youtubeChannel;
      
      if (!youtubeChannel) {
        return res.json({
          hasChannel: false,
          verificationStatus: null
        });
      }

      res.json({
        hasChannel: true,
        verificationStatus: youtubeChannel.verificationStatus,
        channelName: youtubeChannel.channelName,
        channelUrl: youtubeChannel.channelUrl,
        subscriberCount: youtubeChannel.subscriberCount,
        submittedAt: youtubeChannel.submittedAt,
        verifiedAt: youtubeChannel.verifiedAt,
        rejectionReason: youtubeChannel.rejectionReason
      });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get pending verification requests (Admin)
  app.get("/api/admin/youtube-verifications/pending", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const db = await getDb();
      const pendingRequests = await db.collection("youtubeVerificationRequests")
        .find({ status: "pending" })
        .sort({ submittedAt: -1 })
        .toArray();

      res.json({
        success: true,
        count: pendingRequests.length,
        requests: pendingRequests
      });
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Approve verification (Admin)
  app.post("/api/admin/youtube-verifications/:requestId/approve", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.params;
      const db = await getDb();

      // Get verification request
      const request = await db.collection("youtubeVerificationRequests").findOne({
        _id: new ObjectId(requestId)
      });

      if (!request) {
        return res.status(404).json({ message: "Verification request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request already processed" });
      }

      // Update verification request
      await db.collection("youtubeVerificationRequests").updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            status: "approved",
            reviewedAt: new Date(),
            reviewedBy: new ObjectId(req.user!.id)
          }
        }
      );

      // Update artist profile
      await db.collection("users").updateOne(
        { _id: new ObjectId(request.artistId) },
        {
          $set: {
            "artist.youtubeChannel.verificationStatus": "verified",
            "artist.youtubeChannel.verifiedAt": new Date(),
            "artist.youtubeChannel.verifiedBy": new ObjectId(req.user!.id)
          }
        }
      );

      console.log(`✅ YouTube verification approved by admin: ${request.artistName} → ${request.channelName}`);

      // TODO: Send email notification to artist

      res.json({
        success: true,
        message: "Verification approved successfully"
      });
    } catch (error) {
      console.error("Error approving verification:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reject verification (Admin)
  app.post("/api/admin/youtube-verifications/:requestId/reject", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const db = await getDb();

      // Get verification request
      const request = await db.collection("youtubeVerificationRequests").findOne({
        _id: new ObjectId(requestId)
      });

      if (!request) {
        return res.status(404).json({ message: "Verification request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request already processed" });
      }

      // Update verification request
      await db.collection("youtubeVerificationRequests").updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            status: "rejected",
            rejectionReason: reason,
            reviewedAt: new Date(),
            reviewedBy: new ObjectId(req.user!.id)
          }
        }
      );

      // Update artist profile
      await db.collection("users").updateOne(
        { _id: new ObjectId(request.artistId) },
        {
          $set: {
            "artist.youtubeChannel.verificationStatus": "rejected",
            "artist.youtubeChannel.rejectionReason": reason,
            "artist.youtubeChannel.rejectedAt": new Date(),
            "artist.youtubeChannel.rejectedBy": new ObjectId(req.user!.id)
          }
        }
      );

      console.log(`❌ YouTube verification rejected by admin: ${request.artistName} → ${request.channelName} (Reason: ${reason})`);

      // TODO: Send email notification to artist

      res.json({
        success: true,
        message: "Verification rejected successfully"
      });
    } catch (error) {
      console.error("Error rejecting verification:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
