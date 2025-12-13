import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { AnalyticsService } from "../services/analytics";
import { ObjectId } from "mongodb";

// Database connection helper
async function getDb() {
  return storage.db;
}

export function setupArtistRoutes(app: Express) {
  // Get featured artists
  app.get("/api/artists/featured", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const artists = await storage.getFeaturedArtists(limit);
      res.json(artists);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist profile (for logged-in artist)
  app.get("/api/artists/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (req.user.role !== "artist") {
        return res.status(403).json({ message: "Access denied. Artist role required." });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      res.json(artist);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get songs by logged-in artist
  app.get("/api/artists/songs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (req.user.role !== "artist") {
        return res.status(403).json({ message: "Access denied. Artist role required." });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const songs = await storage.getSongsByArtist(artist._id);
      res.json(songs);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist analytics
  app.get("/api/artists/analytics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }



      // Allow both "artist" and "admin" roles to access analytics
      if (!["artist", "admin"].includes(req.user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Artist role required."
        });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        // Return default analytics for users without artist profile
        return res.json({
          monthlyRevenue: 0,
          subscriptionRevenue: 0,
          merchRevenue: 0,
          eventRevenue: 0,
          totalPlays: 0,
          uniqueListeners: 0,
          totalLikes: 0,
          newFollowers: 0,
          newSubscribers: 0,
          conversionRate: 0,
          topSongs: [],
          message: "Artist profile not found - showing default values"
        });
      }

      // Use new analytics service to get comprehensive dashboard data
      const dashboardData = await AnalyticsService.getArtistDashboard(artist._id);

      // Get top songs (with proper aggregation and field initialization)
      const songs = await storage.getSongsByArtist(artist._id);
      
      // Ensure all songs have required fields initialized (one-time migration)
      for (const song of songs) {
        if ((song as any).plays === undefined || (song as any).likes === undefined) {
          await storage.db.collection("songs").updateOne(
            { _id: new ObjectId(song._id) },
            { 
              $set: { 
                plays: (song as any).plays || 0,
                likes: (song as any).likes || 0,
                uniqueListeners: (song as any).uniqueListeners || 0,
                shares: (song as any).shares || 0
              }
            }
          );
        }
      }
      
      // Re-fetch songs with updated fields
      const updatedSongs = await storage.getSongsByArtist(artist._id);
      
      // Calculate favorites-based likes for each song (count users who favorited each song)
      const { MongoClient } = await import('mongodb');
      const getDb = async () => {
        const { storage: storageInstance } = await import('../storage');
        return (storageInstance as any).db;
      };
      const database = await getDb();
      
      const songsWithFavoriteLikes = await Promise.all(
        updatedSongs.map(async (song) => {
          let favoritesBasedLikes = 0;
          try {
            if (database) {
              favoritesBasedLikes = await database.collection("users").countDocuments({
                "favorites.songs": song._id.toString()
              });
            }
          } catch (error) {
            console.log('Error calculating song likes:', error);
          }
          
          return {
            ...song,
            favoritesLikes: favoritesBasedLikes
          };
        })
      );
      
      const topSongs = songsWithFavoriteLikes
        .sort((a, b) => ((a as any).plays || 0) - ((b as any).plays || 0))
        .slice(0, 5)
        .map(song => ({
          _id: song._id,
          title: song.title,
          plays: (song as any).plays || 0,
          likes: (song as any).favoritesLikes || 0 // Use favorites-based count
        }));

      res.json({
        monthlyRevenue: dashboardData.totalEarnings,
        subscriptionRevenue: dashboardData.subscriptionRevenue,
        merchRevenue: dashboardData.merchRevenue,
        eventRevenue: dashboardData.eventRevenue,
        totalPlays: dashboardData.totalPlays,
        uniqueListeners: dashboardData.uniqueListeners,
        totalLikes: dashboardData.totalLikes,
        newFollowers: 0, // Could be enhanced with time-based queries
        newSubscribers: dashboardData.newSubscribers,
        topSongs
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist earnings breakdown
  app.get("/api/artists/earnings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Allow both "artist" and "admin" roles to access earnings
      if (!["artist", "admin"].includes(req.user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Artist role required."
        });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        // Return default earnings for users without artist profile
        return res.json({
          totalEarnings: 0,
          pendingPayouts: 0,
          lastPayoutDate: null,
          nextPayoutDate: null,
          breakdown: {
            subscriptions: 0,
            merchandise: 0,
            events: 0,
            adRevenue: 0,
            streamingEarnings: 0
          },
          platformFee: 10
        });
      }

      // Get earnings data from analytics service
      const dashboardData = await AnalyticsService.getArtistDashboard(artist._id);

      // Get current available balance
      const artistData = artist as any;
      const availableBalance = artistData.artist?.availableBalance || 0;

      // Calculate next payout date (assuming monthly on 1st)
      const now = new Date();
      const nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      res.json({
        totalEarnings: dashboardData.totalEarnings,
        availableBalance: availableBalance, // Current available balance
        pendingPayouts: dashboardData.totalEarnings, // Assuming all earnings are pending
        lastPayoutDate: null, // Would need payout history tracking
        nextPayoutDate: nextPayout.toISOString(),
        breakdown: {
          subscriptions: dashboardData.subscriptionRevenue,
          merchandise: dashboardData.merchRevenue,
          events: dashboardData.eventRevenue,
          adRevenue: 0, // Not implemented yet
          streamingEarnings: 0 // Not implemented yet
        },
        platformFee: 10
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist payout data (balance and history)
  app.get("/api/artists/payouts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Allow both "artist" and "admin" roles to access payout data
      if (!["artist", "admin"].includes(req.user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Artist role required."
        });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      // Get current balance and earnings data from analytics service
      const dashboardData = await AnalyticsService.getArtistDashboard(artist._id);
      const artistData = artist as any;
      const availableBalance = artistData.artist?.availableBalance || 0;
      
      // Get payout history from admin payouts collection
      const database = await getDb();
      const allPayouts = await database.collection('payouts').find({
        artistId: artist._id.toString() // Use string comparison since payouts store artistId as string
      }).sort({ createdAt: -1 }).toArray();

      // Calculate total withdrawn from completed payouts
      const totalWithdrawn = allPayouts
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + (p.payoutAmount || p.amount || 0), 0);

      // Total earnings from dashboard data
      const totalEarnings = dashboardData.totalEarnings || 0;

      // Format payout history
      const formattedHistory = allPayouts.map((payout: any) => ({
        id: payout._id,
        amount: payout.payoutAmount || payout.amount || 0,
        status: payout.status,
        date: payout.createdAt,
        razorpayPayoutId: payout.razorpayPayoutId || null,
        bankAccount: payout.accountNumber ? `***${payout.accountNumber.slice(-4)}` : null,
        method: 'bank_transfer'
      }));

      // Calculate pending amount (might be different from availableBalance if there are processing payouts)
      const processingPayouts = allPayouts
        .filter((p: any) => p.status === 'processing')
        .reduce((sum: number, p: any) => sum + (p.payoutAmount || p.amount || 0), 0);

      res.json({
        availableBalance,
        totalEarnings,
        totalWithdrawn,
        processingAmount: processingPayouts,
        payoutHistory: formattedHistory,
        summary: {
          thisMonth: {
            earned: 0, // Could be calculated with date filtering
            withdrawn: allPayouts
              .filter((p: any) => p.createdAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
              .reduce((sum: number, p: any) => sum + (p.status === 'completed' ? (p.payoutAmount || p.amount || 0) : 0), 0)
          },
          lastMonth: {
            earned: 0, // Could be calculated with date filtering
            withdrawn: 0 // Could be calculated with date filtering
          }
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update artist profile
  app.patch("/api/artists/profile", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);

      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const updatedArtist = await storage.updateUser(artist._id, {
        artist: { ...artist.artist, ...req.body },
      });

      res.json(updatedArtist?.artist || {});
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get artist by ID (public route) - with subscription filtering
  app.get("/api/artists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const artist = await storage.getArtistByUserId(id);

      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      // Get user's subscription status if authenticated
      let isSubscribed = false;
      const authHeader = req.headers.authorization;
      let currentUserId = null;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          currentUserId = decoded.id;

          // ✅ FIX: Check if user is subscribed to this artist using subscriptions collection
          const activeSubscriptions = await storage.db.collection("subscriptions").find({
            fanId: new ObjectId(currentUserId),
            artistId: new ObjectId(id),
            active: true,
            endDate: { $gt: new Date() }
          }).toArray();
          
          isSubscribed = activeSubscriptions.length > 0 || currentUserId === id; // Artist can see their own content
        } catch (tokenError) {
          // Invalid token, proceed as unauthenticated
        }
      }

      // Get artist's content in parallel
      const [allSongs, events, merch, blogs] = await Promise.all([
        storage.getSongsByArtist(id),
        storage.getEventsByArtist(id),
        storage.getMerchByArtist(id),
        storage.getBlogsByArtist(id)
      ]);

      // Calculate favorites-based likes for each individual song
      const songsWithFavoriteLikes = await Promise.all(
        allSongs.map(async (song) => {
          let favoritesBasedLikes = 0;
          try {
            const getDb = async () => {
              const { storage: storageInstance } = await import('../storage');
              return (storageInstance as any).db;
            };
            const database = await getDb();
            
            if (database) {
              favoritesBasedLikes = await database.collection("users").countDocuments({
                "favorites.songs": song._id.toString()
              });
            }
          } catch (error) {
            console.log('Error calculating song likes for profile:', error);
          }
          
          return {
            ...song,
            likes: favoritesBasedLikes // Override with favorites-based count
          };
        })
      );

      // ✅ FIX: Filter songs based on subscription status
      const filteredSongs = songsWithFavoriteLikes.map(song => {
        if (song.visibility === "SUBSCRIBER_ONLY" && !isSubscribed) {
          // Return limited info for subscriber-only songs
          return {
            _id: song._id,
            title: song.title,
            artistId: song.artistId,
            artistName: song.artistName,
            visibility: song.visibility,
            isPremium: true,
            isLocked: true,
            artworkUrl: song.artworkUrl, // Still show artwork
            durationSec: song.durationSec,
            genre: song.genre,
            createdAt: song.createdAt,
            // Don't include fileUrl, lyrics, or other premium content
          };
        }
        return {
          ...song,
          isPremium: song.visibility === "SUBSCRIBER_ONLY",
          isLocked: false
        };
      });

      // Calculate favorites-based total likes for artist profile
      let favoriteBasedTotalLikes = 0;
      try {
        const getDb = async () => {
          const { storage: storageInstance } = await import('../storage');
          return (storageInstance as any).db;
        };
        const database = await getDb();
        
        if (database && allSongs.length > 0) {
          const songIds = allSongs.map((s: any) => s._id.toString());
          const aggregationResult = await database.collection("users").aggregate([
            {
              $match: {
                "favorites.songs": { $in: songIds }
              }
            },
            {
              $project: {
                matchedFavorites: {
                  $size: {
                    $filter: {
                      input: "$favorites.songs",
                      as: "song",
                      cond: { $in: ["$$song", songIds] }
                    }
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                totalLikes: { $sum: "$matchedFavorites" }
              }
            }
          ]).toArray();
          
          favoriteBasedTotalLikes = aggregationResult.length > 0 ? aggregationResult[0].totalLikes : 0;
        }
      } catch (error) {
        console.log('Error calculating artist total likes:', error);
        favoriteBasedTotalLikes = artist.artist?.totalLikes || 0;
      }

      // Include subscription settings for fans to see pricing
      const subscriptionSettings = artist.artist?.subscriptionSettings || {
        monthlyPrice: 99,
        yearlyPrice: 999,
        benefits: ["Early access to new releases", "Exclusive content", "Behind the scenes"],
        isActive: false
      };

      const response = {
        ...artist,
        artist: {
          ...(artist.artist || {}),
          totalLikes: favoriteBasedTotalLikes // Override with favorites-based count
        },
        user: {
          _id: artist._id,
          name: artist.name,
          email: artist.email
        },
        songs: filteredSongs,
        events,
        merch,
        blogs,
        isSubscribed,
        subscriptionSettings // Add subscription settings for fans to view
      };

      res.json(response);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // 🔹 ARTIST SUBSCRIPTION SETTINGS ROUTES
  // =============================================

  // Get artist subscription settings
  app.get("/api/artists/subscription-settings", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      // Get subscription settings from artist profile
      const subscriptionSettings = artist.artist?.subscriptionSettings || {
        monthlyPrice: 99,
        yearlyPrice: 999,
        benefits: ["Early access to new releases", "Exclusive content", "Behind the scenes"],
        isActive: false
      };

      res.json(subscriptionSettings);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update artist subscription settings
  app.put("/api/artists/subscription-settings", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      const { monthlyPrice, yearlyPrice, benefits, isActive } = req.body;

      // Validate input
      if (typeof monthlyPrice !== 'number' || monthlyPrice < 0) {
        return res.status(400).json({ message: "Monthly price must be a positive number" });
      }
      if (typeof yearlyPrice !== 'number' || yearlyPrice < 0) {
        return res.status(400).json({ message: "Yearly price must be a positive number" });
      }
      if (!Array.isArray(benefits)) {
        return res.status(400).json({ message: "Benefits must be an array" });
      }

      const artist = await storage.getArtistByUserId(req.user!.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const subscriptionSettings = {
        monthlyPrice,
        yearlyPrice,
        benefits: benefits.filter(benefit => benefit && benefit.trim()),
        isActive: Boolean(isActive),
        updatedAt: new Date()
      };

      // Update artist profile with subscription settings
      const updatedArtist = await storage.updateUser(artist._id, {
        artist: { 
          ...artist.artist, 
          subscriptionSettings 
        }
      });

      if (!updatedArtist) {
        return res.status(500).json({ message: "Failed to update subscription settings" });
      }

      res.json({
        message: "Subscription settings updated successfully",
        settings: subscriptionSettings
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all artists
  app.get("/api/artists", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      const artists = await storage.getAllArtists(limit);

      // Enrich with additional info
      const enrichedArtists = await Promise.all(
        artists.map(async (artist) => {
          const songs = await storage.getSongsByArtist(artist._id);
          const totalPlays = songs.reduce((sum, song) => sum + (song.plays || 0), 0);

          return {
            ...artist,
            user: {
              _id: artist._id,
              name: artist.name,
              email: artist.email
            },
            songsCount: songs.length,
            totalPlays,
            // Ensure we have the artist profile data
            artist: artist.artist || {
              bio: "",
              socialLinks: {},
              followers: [],
              totalPlays: totalPlays,
              totalLikes: 0,
              revenue: { subscriptions: 0, merch: 0, events: 0, ads: 0 },
              trendingScore: totalPlays,
              featured: false,
              verified: false,
            }
          };
        })
      );

      res.json(enrichedArtists);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

