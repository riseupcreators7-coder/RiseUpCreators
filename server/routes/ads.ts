import type { Express } from "express";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { normalizeAdPlacement } from "../utils/ads";

export function setupAdsRoutes(app: Express) {
  // ========================================
  // ADS API ROUTES (for client consumption)
  // ========================================

  // Get all campaigns (for frontend display)
  app.get("/api/ads/campaigns", async (req, res) => {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;

      const query: any = { status: "ACTIVE" }; // Only show active campaigns to public
      if (type) query.type = type;

      const campaigns = await storage.db.collection("ad_campaigns")
        .find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .toArray();

      const total = await storage.db.collection("ad_campaigns").countDocuments(query);

      res.json({
        campaigns,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get audio ads
  app.get("/api/ads/audio", async (req, res) => {
    try {
      const { placement, limit = 20 } = req.query;

      const query: any = { 
        status: "ACTIVE",
        approved: true,
        isDeleted: { $ne: true }
      };
      
      if (placement) {
        query.placements = { $in: [placement] };
      }

      const audioAds = await storage.db.collection("audio_ads")
        .find(query)
        .limit(parseInt(limit as string))
        .toArray();

      res.json(audioAds);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get specific audio ad
  app.get("/api/ads/audio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const audioAd = await storage.db.collection("audio_ads").findOne({
        _id: new ObjectId(id),
        status: "ACTIVE",
        approved: true,
        isDeleted: { $ne: true }
      });

      if (!audioAd) {
        return res.status(404).json({ message: "Audio ad not found" });
      }

      res.json(audioAd);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get banner ads
  app.get("/api/ads/banner", async (req, res) => {
    try {
      // Set cache headers to reduce repeated requests
      res.set({
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'ETag': `banner-${Date.now()}`,
      });

      const { placement, size, limit = 20 } = req.query;

      const query: any = { 
        status: "ACTIVE",
        approved: true,
        isDeleted: { $ne: true }
      };
      
      if (placement) {
        query.placements = { $in: [placement] };
      }
      
      if (size) {
        query.size = size;
      }

      const bannerAds = await storage.db.collection("banner_ads")
        .find(query)
        .limit(parseInt(limit as string))
        .toArray();

      res.json(bannerAds);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get specific banner ad
  app.get("/api/ads/banner/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const bannerAd = await storage.db.collection("banner_ads").findOne({
        _id: new ObjectId(id),
        status: "ACTIVE",
        approved: true,
        isDeleted: { $ne: true }
      });

      if (!bannerAd) {
        return res.status(404).json({ message: "Banner ad not found" });
      }

      res.json(bannerAd);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get ads for user based on placement and type (no auth required for basic ad serving)
  app.get("/api/ads/for-user", async (req, res) => {
    try {
      const { type, placement, limit = 5, userId } = req.query;

      if (!type || !placement) {
        return res.status(400).json({ message: "Type and placement are required" });
      }

      let collection: string;
      if (type === "AUDIO") {
        collection = "audio_ads";
      } else if (type === "BANNER") {
        collection = "banner_ads";
      } else {
        return res.status(400).json({ message: "Invalid ad type" });
      }
      

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Handle placement variations differently for audio vs banner ads
      let placementVariations: string[];
      
      if (type === "AUDIO") {
        // For audio ads, use the placement as-is and common variations
        const rawPlacement = (placement as string).toUpperCase();
        placementVariations = [
          rawPlacement,
          rawPlacement.toLowerCase(),
          `AUDIO_${rawPlacement}`,
          `audio_${rawPlacement.toLowerCase()}`
        ];
      } else {
        // For banner ads, use the existing normalization logic
        const normalizedPlacement = normalizeAdPlacement(placement as string);
        placementVariations = [
          normalizedPlacement,
          normalizedPlacement.toLowerCase(),
          `BANNER_${normalizedPlacement}`,
          `banner_${normalizedPlacement.toLowerCase()}`
        ];
      }
      
      // Simplified and more robust query structure
      const finalQuery: any = {
        status: "ACTIVE",
        approved: true,
        // Handle both isDeleted boolean and missing field cases
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false },
          { isDeleted: { $ne: true } }
        ],
        // Check for any placement variation to be more inclusive
        placements: { $in: placementVariations }
      };

      // Add date range filters only if the fields exist and are valid dates
      // This prevents issues with malformed dates or timezone problems
      const dateFilters = [];
      
      // Start date filter: ad should have started or have no start date
      dateFilters.push({
        $or: [
          { startAt: { $exists: false } },
          { startAt: null },
          { startAt: { $lte: now } }
        ]
      });
      
      // End date filter: ad should not have ended or have no end date
      dateFilters.push({
        $or: [
          { endAt: { $exists: false } },
          { endAt: null },
          { endAt: { $gte: now } }
        ]
      });

      // Combine all filters
      finalQuery.$and = dateFilters;

      // Check how many active ads exist and query for eligible ads
      let adsWithBudget = await storage.db.collection(collection)
        .find(finalQuery)
        .toArray();
        
      // Fallback: If no ads found with date restrictions, try without date filters
      // This helps when there are timezone issues or clock drift problems
      if (adsWithBudget.length === 0) {
          const fallbackQuery: any = {
            status: "ACTIVE",
            approved: true,
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false },
              { isDeleted: { $ne: true } }
            ],
            placements: { $in: placementVariations }
          };
          
          const fallbackAds = await storage.db.collection(collection)
            .find(fallbackQuery)
            .toArray();
          
          if (fallbackAds.length > 0) {
            // Manual date filtering with more lenient rules (5 minute buffer)
            const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
            const bufferedNow = new Date(now.getTime() + buffer);
            const bufferedPast = new Date(now.getTime() - buffer);
            
            adsWithBudget = fallbackAds.filter((ad: any) => {
              // Check start date with buffer
              const startOk = !ad.startAt || 
                             ad.startAt === null || 
                             new Date(ad.startAt) <= bufferedNow;
              
              // Check end date with buffer  
              const endOk = !ad.endAt || 
                           ad.endAt === null || 
                           new Date(ad.endAt) >= bufferedPast;
              
              return startOk && endOk;
            });
          }
        }

      // Filter ads that still have budget (if remainingBudget field exists and is > 0)
      let eligibleAds = adsWithBudget.filter((ad: any) => {
        if (ad.remainingBudget !== undefined && ad.remainingBudget !== null) {
          return ad.remainingBudget > 0;
        }
        return true; // Include ads without budget tracking
      });

      // NEW: Filter out ads that have reached daily frequency limit (3 times per day per user)
      if (userId) {
        // Get today's ad impressions for this user
        const todayImpressions = await storage.db.collection("ad_impressions")
          .find({
            userId: new ObjectId(userId as string),
            timestamp: { $gte: today }
          })
          .toArray();

        // Count impressions per ad ID today
        const adImpressionCounts = new Map<string, number>();
        todayImpressions.forEach((impression: any) => {
          const adIdStr = impression.adId.toString();
          adImpressionCounts.set(adIdStr, (adImpressionCounts.get(adIdStr) || 0) + 1);
        });

        // Filter out ads that have been shown 3+ times today
        eligibleAds = eligibleAds.filter((ad: any) => {
          const adIdStr = ad._id.toString();
          const impressionCount = adImpressionCounts.get(adIdStr) || 0;
          
          if (impressionCount >= 3) {
            return false;
          }
          return true;
        });
      }

      // Sort by priority: ads with campaign + rotation to prevent same ads
      eligibleAds.sort((a: any, b: any) => {
        // Prioritize ads with campaigns
        if (a.campaignId && !b.campaignId) return -1;
        if (!a.campaignId && b.campaignId) return 1;
        
        // Then sort by impressions (rotate popular ads)
        return (a.impressions || 0) - (b.impressions || 0); // Show less-viewed ads first
      });

      // Limit results
      const limitedAds = eligibleAds.slice(0, parseInt(limit as string));

      res.json(limitedAds);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track ad impression (supports both authenticated and anonymous users)
  app.post("/api/ads/impressions", async (req, res) => {
    try {
      const { adId, adType, placement, deviceInfo } = req.body;

      if (!adId || !adType || !placement) {
        return res.status(400).json({ message: "AdId, adType, and placement are required" });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(adId)) {
        return res.status(400).json({ message: "Invalid ad ID format" });
      }

      // Try to get user ID from auth header if provided
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.SESSION_SECRET || "your-secret-key-here") as any;
          userId = decoded.id; // Use the actual user ID field from token
        } catch (error) {
          // Invalid token, continue as anonymous user
        }
      }

      // Check for duplicate impressions within the last 30 seconds to prevent spam
      const recentImpressionCheck = {
        adId: new ObjectId(adId),
        timestamp: { $gte: new Date(Date.now() - 30000) }, // 30 seconds ago
        $or: [
          { ip: req.ip },
          ...(userId ? [{ userId: new ObjectId(userId) }] : [])
        ]
      };

      const recentImpression = await storage.db.collection("ad_impressions").findOne(recentImpressionCheck);
      if (recentImpression) {
        // Return success but don't create duplicate
        return res.json({ 
          _id: recentImpression._id,
          message: "Impression tracked successfully",
          adId,
          adType,
          placement,
          duplicate: true
        });
      }

      const impression = {
        _id: new ObjectId(),
        adId: new ObjectId(adId),
        userId: userId ? new ObjectId(userId) : null, // null for anonymous users
        adType,
        placement,
        deviceInfo: deviceInfo || {},
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get("User-Agent")
      };

      // Insert impression record
      await storage.db.collection("ad_impressions").insertOne(impression);

      // Update ad impression count atomically (only for non-duplicates)
      const collection = adType === "AUDIO" ? "audio_ads" : "banner_ads";
      await storage.db.collection(collection).updateOne(
        { _id: new ObjectId(adId) },
        { $inc: { impressions: 1 } }
      );

      res.json({ 
        _id: impression._id,
        message: "Impression tracked successfully",
        adId,
        adType,
        placement
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track ad click (supports both authenticated and anonymous users)
  app.post("/api/ads/clicks", async (req, res) => {
    try {
      const { adId, adType, impressionId } = req.body;

      if (!adId || !adType) {
        return res.status(400).json({ message: "AdId and adType are required" });
      }

      // Try to get user ID from auth header if provided
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.SESSION_SECRET || "your-secret-key-here") as any;
          userId = decoded.id; // Use the actual user ID field from token
        } catch (error) {
          // Invalid token, continue as anonymous user
        }
      }

      const click = {
        _id: new ObjectId(),
        adId: new ObjectId(adId),
        impressionId: impressionId ? new ObjectId(impressionId) : null,
        userId: userId ? new ObjectId(userId) : null, // null for anonymous users
        adType,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get("User-Agent")
      };

      await storage.db.collection("ad_clicks").insertOne(click);

      // Update ad click count
      const collection = adType === "AUDIO" ? "audio_ads" : "banner_ads";
      await storage.db.collection(collection).updateOne(
        { _id: new ObjectId(adId) },
        { $inc: { clicks: 1 } }
      );

      res.json({ 
        _id: click._id,
        message: "Click tracked successfully" 
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track ad completion (supports both authenticated and anonymous users)
  app.post("/api/ads/completions", async (req, res) => {
    try {
      const { adId, adType, placement, impressionId } = req.body;

      if (!adId || !adType) {
        return res.status(400).json({ message: "AdId and adType are required" });
      }

      // Try to get user ID from auth header if provided
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.SESSION_SECRET || "your-secret-key-here") as any;
          userId = decoded.id; // Use the actual user ID field from token
        } catch (error) {
          // Invalid token, continue as anonymous user
        }
      }

      const completion = {
        _id: new ObjectId(),
        adId: new ObjectId(adId),
        impressionId: impressionId ? new ObjectId(impressionId) : null,
        userId: userId ? new ObjectId(userId) : null, // null for anonymous users
        adType,
        placement: placement || 'player',
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get("User-Agent")
      };

      await storage.db.collection("ad_completions").insertOne(completion);

      // Update ad completion count
      const collection = adType === "AUDIO" ? "audio_ads" : "banner_ads";
      await storage.db.collection(collection).updateOne(
        { _id: new ObjectId(adId) },
        { $inc: { completions: 1 } }
      );

      res.json({ 
        _id: completion._id,
        message: "Completion tracked successfully" 
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get daily ad frequency stats for a user (debugging endpoint)
  app.get("/api/ads/daily-stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's impressions for this user
      const todayImpressions = await storage.db.collection("ad_impressions")
        .find({
          userId: new ObjectId(userId),
          timestamp: { $gte: today, $lt: tomorrow }
        })
        .toArray();

      // Count impressions per ad
      const adCounts = new Map<string, any>();
      todayImpressions.forEach((impression: any) => {
        const adIdStr = impression.adId.toString();
        if (!adCounts.has(adIdStr)) {
          adCounts.set(adIdStr, {
            adId: adIdStr,
            count: 0,
            adType: impression.adType,
            placement: impression.placement,
            timestamps: []
          });
        }
        const adStat = adCounts.get(adIdStr)!;
        adStat.count++;
        adStat.timestamps.push(impression.timestamp);
      });

      // Convert to array and sort by count
      const dailyStats = Array.from(adCounts.values()).sort((a, b) => b.count - a.count);

      // Get ad details
      const adIds = dailyStats.map(stat => new ObjectId(stat.adId));
      const audioAds = await storage.db.collection("audio_ads")
        .find({ _id: { $in: adIds } })
        .toArray();
      
      const bannerAds = await storage.db.collection("banner_ads")
        .find({ _id: { $in: adIds } })
        .toArray();

      const allAds = [...audioAds, ...bannerAds];
      const adMap = new Map(allAds.map(ad => [ad._id.toString(), ad]));

      // Enrich stats with ad details
      const enrichedStats = dailyStats.map(stat => ({
        ...stat,
        adTitle: adMap.get(stat.adId)?.title || 'Unknown Ad',
        reachedLimit: stat.count >= 3
      }));

      res.json({
        userId,
        date: today.toISOString().split('T')[0],
        totalImpressions: todayImpressions.length,
        uniqueAds: dailyStats.length,
        maxAllowedPerAd: 3,
        adBreakdown: enrichedStats,
        adsAtLimit: enrichedStats.filter(stat => stat.reachedLimit).length
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app.get("/api/ads/analytics", async (req, res) => {
    try {
      const { adId, type, period = "7d" } = req.query;

      // Calculate date range based on period
      let startDate: Date;
      const endDate = new Date();
      
      switch (period) {
        case "1d":
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }

      let analytics: any = {};

      if (adId) {
        // Validate ObjectId format
        if (!ObjectId.isValid(adId as string)) {
          return res.status(400).json({ message: "Invalid ad ID format" });
        }

        // Get analytics for specific ad
        const impressions = await storage.db.collection("ad_impressions").countDocuments({
          adId: new ObjectId(adId as string),
          timestamp: { $gte: startDate, $lte: endDate }
        });

        const clicks = await storage.db.collection("ad_clicks").countDocuments({
          adId: new ObjectId(adId as string),
          timestamp: { $gte: startDate, $lte: endDate }
        });

        const completions = await storage.db.collection("ad_completions").countDocuments({
          adId: new ObjectId(adId as string),
          timestamp: { $gte: startDate, $lte: endDate }
        });

        analytics = {
          adId,
          impressions,
          clicks,
          completions,
          ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0,
          completionRate: impressions > 0 ? ((completions / impressions) * 100).toFixed(2) : 0,
          period
        };
      } else {
        // Get overall analytics with optional type filter
        const impressionQuery: any = {
          timestamp: { $gte: startDate, $lte: endDate }
        };
        const clickQuery: any = {
          timestamp: { $gte: startDate, $lte: endDate }
        };
        const completionQuery: any = {
          timestamp: { $gte: startDate, $lte: endDate }
        };

        if (type && type !== "all") {
          impressionQuery.adType = type;
          clickQuery.adType = type;
          completionQuery.adType = type;
        }

        const totalImpressions = await storage.db.collection("ad_impressions").countDocuments(impressionQuery);
        const totalClicks = await storage.db.collection("ad_clicks").countDocuments(clickQuery);
        const totalCompletions = await storage.db.collection("ad_completions").countDocuments(completionQuery);

        // Get active ads count
        const activeAudioAds = await storage.db.collection("audio_ads").countDocuments({ 
          status: "ACTIVE", 
          isDeleted: { $ne: true } 
        });
        const activeBannerAds = await storage.db.collection("banner_ads").countDocuments({ 
          status: "ACTIVE", 
          isDeleted: { $ne: true } 
        });

        // Get top performing ads for the period
        const topPerformers = await getTopPerformingAds(startDate, endDate, type as string);

        analytics = {
          totalImpressions,
          totalClicks,
          totalCompletions,
          overallCtr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
          completionRate: totalImpressions > 0 ? ((totalCompletions / totalImpressions) * 100).toFixed(2) : 0,
          period,
          activeAds: {
            audio: activeAudioAds,
            banner: activeBannerAds
          },
          topPerformers,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        };
      }

      res.json(analytics);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin endpoints for managing ads (create, update, delete)
  app.post("/api/ads/audio", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user has permission (admin or content creator)
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const audioAdData = {
        ...req.body,
        _id: new ObjectId(),
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "ACTIVE",
        approved: req.user.role === "admin", // Auto-approve for admins
        impressions: 0,
        clicks: 0,
        revenue: 0
      };

      await storage.db.collection("audio_ads").insertOne(audioAdData);

      res.json({
        message: "Audio ad created successfully",
        _id: audioAdData._id.toString()
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/ads/banner", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user has permission (admin or content creator)
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const bannerAdData = {
        ...req.body,
        _id: new ObjectId(),
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "ACTIVE",
        approved: req.user.role === "admin", // Auto-approve for admins
        impressions: 0,
        clicks: 0,
        revenue: 0
      };

      await storage.db.collection("banner_ads").insertOne(bannerAdData);

      res.json({
        message: "Banner ad created successfully",
        _id: bannerAdData._id.toString()
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update audio ad
  app.put("/api/ads/audio/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid audio ad ID format" });
      }

      const updates = {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };

      // Remove any undefined or null values
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined || updates[key] === null) {
          delete updates[key];
        }
      });

      const result = await storage.db.collection("audio_ads").updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Audio ad not found" });
      }

      // Get the updated ad
      const updatedAd = await storage.db.collection("audio_ads").findOne({ _id: new ObjectId(id) });

      res.json({ 
        message: "Audio ad updated successfully",
        ad: updatedAd
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update banner ad
  app.put("/api/ads/banner/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid banner ad ID format" });
      }

      const updates = {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };

      // Remove any undefined or null values
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined || updates[key] === null) {
          delete updates[key];
        }
      });

      const result = await storage.db.collection("banner_ads").updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Banner ad not found" });
      }

      // Get the updated ad
      const updatedAd = await storage.db.collection("banner_ads").findOne({ _id: new ObjectId(id) });

      res.json({ 
        message: "Banner ad updated successfully",
        ad: updatedAd,
        placements: updatedAd?.placements || []
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete audio ad
  app.delete("/api/ads/audio/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;

      const result = await storage.db.collection("audio_ads").updateOne(
        { _id: new ObjectId(id) },
        { $set: { isDeleted: true, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Audio ad not found" });
      }

      res.json({ message: "Audio ad deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete banner ad
  app.delete("/api/ads/banner/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !["admin", "artist"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;

      const result = await storage.db.collection("banner_ads").updateOne(
        { _id: new ObjectId(id) },
        { $set: { isDeleted: true, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Banner ad not found" });
      }

      res.json({ message: "Banner ad deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

// Helper function to get top performing ads
async function getTopPerformingAds(startDate: Date, endDate: Date, adType?: string, limit = 5) {
  try {
    // Get impression aggregation pipeline
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          ...(adType && adType !== "all" ? { adType } : {})
        }
      },
      {
        $group: {
          _id: "$adId",
          impressions: { $sum: 1 },
          adType: { $first: "$adType" }
        }
      },
      {
        $sort: { impressions: -1 }
      },
      {
        $limit: limit
      }
    ];

    const topImpressions = await storage.db.collection("ad_impressions").aggregate(pipeline).toArray();

    const topPerformers = [];

    for (const item of topImpressions) {
      const adId = item._id;
      
      // Get clicks for this ad
      const clicks = await storage.db.collection("ad_clicks").countDocuments({
        adId: adId,
        timestamp: { $gte: startDate, $lte: endDate }
      });

      // Get ad details
      const collection = item.adType === "AUDIO" ? "audio_ads" : "banner_ads";
      const ad = await storage.db.collection(collection).findOne({ _id: adId });

      if (ad) {
        const ctr = item.impressions > 0 ? ((clicks / item.impressions) * 100).toFixed(2) : "0.00";

        topPerformers.push({
          adId: adId.toString(),
          title: ad.title || 'Untitled Ad',
          type: item.adType,
          impressions: item.impressions,
          clicks,
          ctr: parseFloat(ctr)
        });
      }
    }

    return topPerformers;
  } catch (error) {
    return [];
  }
}

