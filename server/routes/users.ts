import type { Express } from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { storage } from "../storage";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { uploadImage } from "../services/cloudinary";
import { createOrder, verifyPayment, verifyPaymentWithTracking, getPaymentStatus } from "../services/razorpay";
import { AnalyticsService } from "../services/analytics";

// Multer configuration for file uploads (storing files in memory)
const upload = multer({ storage: multer.memoryStorage() });

export function setupUserRoutes(app: Express) {
  // User profile routes
  app.get("/api/users/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userResponse: any = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        favorites: user.favorites,
        following: user.following,
        avatarUrl: user.avatarUrl,
      };

      // Include balance information for artists
      if (user.role === "artist") {
        const artistUser = user as any;
        userResponse.availableBalance = artistUser.availableBalance || 0;
        userResponse.revenue = artistUser.revenue || { merch: 0, events: 0, subscriptions: 0 };
      }

      res.json(userResponse);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/me/recent-plays", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const recentSongs = await storage.getRecentPlaysByUser(req.user!.id);
      res.json(recentSongs);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateUser(req.user!.id, updates);
      res.json(user);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Following routes
  app.get("/api/users/me/following-content", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get content from followed artists
      const following = user.following || [];
      
      // Ensure following is an array before mapping
      if (!Array.isArray(following)) {
        return res.json([]);
      }

      const followedArtists = await Promise.all(
        following.map((artistId) => storage.getArtistByUserId(artistId)),
      );

      const validArtists = followedArtists.filter(
        (artist) => artist !== undefined,
      );
      res.json(validArtists);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get subscription-aware home feed
  app.get("/api/users/me/home-feed", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ FIX: Get user's active subscriptions from subscriptions collection (not user.subscriptions array)
      const activeSubscriptions = await storage.db.collection("subscriptions").find({
        fanId: new ObjectId(req.user!.id),
        active: true,
        endDate: { $gt: new Date() }
      }).toArray();
      
      const subscribedArtistIds = activeSubscriptions.map(sub => sub.artistId.toString());

      // Get content from subscribed artists first
      const subscribedContent: any[] = [];
      const followingContent: any[] = [];
      const publicContent: any[] = [];

      // ✅ FIX: Get ALL songs (including subscriber-only) for home feed
      const allSongs = await storage.db.collection("songs").find({}).sort({ createdAt: -1 }).limit(50).toArray();

      for (const song of allSongs) {
        const songArtistId = song.artistId.toString();
        const isSubscribedToArtist = subscribedArtistIds.includes(songArtistId);
        const isFollowingArtist = user.following?.includes(song.artistId) || false;
        const isOwnSong = user._id.toString() === songArtistId;

        // Convert song data to proper format
        const convertedSong = {
          ...song,
          _id: song._id.toString(),
          artistId: songArtistId
        };
        
        // Priority 1: Subscribed artist content (including subscriber-only)
        if (isSubscribedToArtist || isOwnSong) {
          subscribedContent.push({
            ...convertedSong,
            isPremium: song.visibility === "SUBSCRIBER_ONLY",
            isSubscribed: true,
            category: "subscribed"
          });
        }
        // Priority 2: Following artist content (public only)
        else if (isFollowingArtist && song.visibility === "PUBLIC") {
          followingContent.push({
            ...convertedSong,
            isPremium: false,
            isSubscribed: false,
            category: "following"
          });
        }
        // Priority 3: Other public content
        else if (song.visibility === "PUBLIC") {
          publicContent.push({
            ...convertedSong,
            isPremium: false,
            isSubscribed: false,
            category: "public"
          });
        }
      }

      // Combine in priority order: subscribed -> following -> public
      const homeFeed = [
        ...subscribedContent.slice(0, 15),  // Top 15 subscribed content
        ...followingContent.slice(0, 10),   // Top 10 following content
        ...publicContent.slice(0, 5)        // Top 5 public content
      ];

      res.json(homeFeed);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check subscription status for a specific artist
  app.get("/api/users/me/subscription-status/:artistId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { artistId } = req.params;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has an active subscription to this artist from subscriptions collection
      const activeSubscription = await storage.db.collection("subscriptions").findOne({
        fanId: new ObjectId(req.user!.id),
        artistId: new ObjectId(artistId),
        active: true,
        endDate: { $gt: new Date() }
      });

      res.json({
        isSubscribed: !!activeSubscription,
        subscription: activeSubscription || null
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/follow/:artistId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { artistId } = req.params;
      const user = await storage.getUser(req.user!.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Ensure following is an array
      const userFollowing = user.following || [];
      const isCurrentlyFollowing = userFollowing.includes(artistId);
      const following = isCurrentlyFollowing
        ? userFollowing.filter((id) => id !== artistId)
        : [...userFollowing, artistId];

      // Update user's following list
      await storage.updateUser(req.user!.id, { following });

      // Update artist's followers list (bidirectional sync)
      const artist = await storage.getArtistByUserId(artistId);
      if (artist && artist.artist) {
        // Ensure followers is an array
        const artistFollowers = artist.artist.followers || [];
        const followers = isCurrentlyFollowing
          ? artistFollowers.filter((id) => id !== req.user!.id)
          : [...artistFollowers, req.user!.id];

        await storage.updateUser(artistId, {
          artist: { ...artist.artist, followers }
        });
      }

      // Track analytics event directly
      try {
        await AnalyticsService.trackEvent(
          req.user!.id,
          isCurrentlyFollowing ? 'unfollow' : 'follow',
          'artist_profile',
          {
            artistId,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            followCount: following.length,
            previousFollowState: isCurrentlyFollowing
          },
          artistId
        );
        
      } catch (analyticsError) {
        
      }

      res.json({ following: !isCurrentlyFollowing });
    } catch (error: any) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Favorites routes
  app.get("/api/users/me/favorites", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const favorites = user.favorites || {
        artists: [],
        songs: [],
        events: [],
        merch: []
      };

      // Ensure favorites properties are arrays
      const safeFavorites = {
        artists: Array.isArray(favorites.artists) ? favorites.artists : [],
        songs: Array.isArray(favorites.songs) ? favorites.songs : [],
        events: Array.isArray(favorites.events) ? favorites.events : [],
        merch: Array.isArray(favorites.merch) ? favorites.merch : []
      };

      // Populate song details for favorites
      const populatedSongs = [];
      for (const songId of safeFavorites.songs) {
        const song = await storage.getSong(songId);
        if (song) {
          populatedSongs.push(song);
        }
      }

      // Populate artist details for favorites
      const populatedArtists = [];
      for (const artistId of safeFavorites.artists) {
        const artist = await storage.getArtistByUserId(artistId);
        if (artist) {
          populatedArtists.push(artist);
        }
      }

      // Populate event details for favorites
      const populatedEvents = [];
      for (const eventId of safeFavorites.events) {
        const event = await storage.getEvent(eventId);
        if (event) {
          populatedEvents.push(event);
        }
      }

      // Populate merch details for favorites
      const populatedMerch = [];
      for (const merchId of safeFavorites.merch) {
        const merch = await storage.getMerch(merchId);
        if (merch) {
          populatedMerch.push(merch);
        }
      }

      res.json({
        artists: populatedArtists,
        songs: populatedSongs,
        events: populatedEvents,
        merch: populatedMerch
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/me/favorites/songs/:songId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { songId } = req.params;
      const user = await storage.getUser(req.user!.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const favorites = user.favorites || {
        artists: [],
        songs: [],
        events: [],
      };
      const songIndex = favorites.songs.indexOf(songId);
      const wasFavorited = songIndex > -1;
      const isNowFavorited = !wasFavorited;

      if (wasFavorited) {
        // Remove from favorites
        favorites.songs.splice(songIndex, 1);
      } else {
        // Add to favorites
        favorites.songs.push(songId);
      }

      // Get song and artist information for analytics
      const song = await storage.getSong(songId);
      const artistId = song?.artistId;

      // ✅ FIX: Update song like count in database
      if (song) {
        try {
          await storage.updateSong(songId, {
            $inc: { 
              likes: isNowFavorited ? 1 : -1 
            }
          });

          // ✅ FIX: Update artist's total likes in their profile
          if (artistId) {
            await storage.db.collection("users").updateOne(
              { _id: new ObjectId(artistId), role: "artist" },
              { 
                $inc: { 
                  "artist.totalLikes": isNowFavorited ? 1 : -1 
                }
              }
            );
          }
        } catch (updateError) {
          
        }
      }

      // Track analytics event
      try {
        await AnalyticsService.trackEvent(
          req.user!.id,
          isNowFavorited ? 'song_like' : 'song_unlike',
          'favorites',
          {
            songId,
            songTitle: song?.title,
            action: isNowFavorited ? 'added' : 'removed',
            timestamp: new Date().toISOString()
          },
          artistId,
          songId
        );
        
      } catch (analyticsError) {
        
      }

      await storage.updateUser(req.user!.id, { favorites });
      res.json({ favorited: isNowFavorited, favorites });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle event favorite
  app.post("/api/users/me/favorites/events/:eventId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get event to ensure it exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Initialize favorites if needed
      const favorites = user.favorites || { artists: [], songs: [], events: [], merch: [] };
      const eventFavorites = Array.isArray(favorites.events) ? favorites.events : [];

      // Toggle favorite
      const isCurrentlyFavorited = eventFavorites.includes(eventId);
      let updatedEventFavorites;

      if (isCurrentlyFavorited) {
        updatedEventFavorites = eventFavorites.filter(id => id !== eventId);
      } else {
        updatedEventFavorites = [...eventFavorites, eventId];
      }

      const isNowFavorited = !isCurrentlyFavorited;

      // Update user favorites
      const updatedFavorites = {
        ...favorites,
        events: updatedEventFavorites
      };

      await storage.updateUser(userId, { favorites: updatedFavorites });

      

      res.json({ 
        isNowFavorited, 
        favorited: isNowFavorited,
        favorites: updatedFavorites 
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Playlist routes
  app.get("/api/playlists/mine", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const playlists = user.playlists || [];

      // Populate songs with artist names
      const populatedPlaylists = await Promise.all(
        playlists.map(async (playlist) => {
          const populatedSongs = await Promise.all(
            playlist.songs.map(async (songId) => {
              const song = await storage.getSong(songId);
              if (song) {
                const artist = await storage.getArtistByUserId(song.artistId);
                return {
                  ...song,
                  artistName: artist?.name || "Unknown Artist"
                };
              }
              return null;
            })
          );

          return {
            ...playlist,
            songs: populatedSongs.filter(song => song !== null)
          };
        })
      );

      res.json(populatedPlaylists);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/playlists", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, songs = [] } = req.body;

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const newPlaylist = {
        name,
        songs,
        createdAt: new Date(),
      };

      const updatedPlaylists = [...(user.playlists || []), newPlaylist];
      await storage.updateUser(req.user!.id, { playlists: updatedPlaylists });

      res.json(newPlaylist);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/playlists/add-song", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { playlistName, songId } = req.body;

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedPlaylists = (user.playlists || []).map((playlist) => {
        if (playlist.name === playlistName) {
          // Check if song is already in playlist
          if (!playlist.songs.includes(songId)) {
            return {
              ...playlist,
              songs: [...playlist.songs, songId],
            };
          }
        }
        return playlist;
      });

      await storage.updateUser(req.user!.id, { playlists: updatedPlaylists });

      res.json({ message: "Song added to playlist" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Settings routes
  app.get("/api/users/me/settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get artist profile if user is an artist
      let artistProfile = null;
      if (user.role === "artist") {
        artistProfile = await storage.getArtistByUserId(user._id);
      }

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          bio: artistProfile?.artist?.bio || "",
          website: artistProfile?.artist?.socialLinks?.website || "",
          instagram: artistProfile?.artist?.socialLinks?.instagram || "",
          youtube: artistProfile?.artist?.socialLinks?.youtube || "",
          x: artistProfile?.artist?.socialLinks?.x || "",
        },
        notifications: {
          email: true,
          newMusic: true,
          events: true,
          marketing: false,
          followers: true,
          revenue: true,
        },
        privacy: {
          visibility: "public",
          activity: true,
          history: true,
          personalizedAds: false,
        },
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user settings
  app.patch("/api/users/me/settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { notifications, privacy } = req.body;
      const user = await storage.getUser(req.user!.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user settings (you can store these in the user document or a separate settings collection)
      // For now, we'll just return success since the frontend handles the logic
      res.json({
        message: "Settings updated successfully",
        notifications,
        privacy,
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Plan upgrade routes
  app.post("/api/users/me/upgrade", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate plan ID
      const validPlans = ["free", "premium", "artist"];
      if (!validPlans.includes(planId.toLowerCase())) {
        return res.status(400).json({ message: "Invalid plan ID" });
      }

      const currentPlan = user.plan?.type?.toUpperCase() || "FREE";
      const requestedPlan = planId.toUpperCase();

      // Check if already on the requested plan
      if (currentPlan === requestedPlan) {
        return res.status(400).json({ message: "Already on this plan" });
      }

      // Handle free plan (no payment required)
      if (requestedPlan === "FREE") {
        await storage.updateUser(req.user!.id, {
          plan: {
            type: "FREE",
            renewsAt: undefined,
            paymentId: undefined,
            subscriptionId: undefined
          }
        });

        return res.json({
          message: "Plan updated successfully",
          plan: { type: "FREE" }
        });
      }

      // Get dynamic pricing from settings
      const settings = await storage.db.collection("system_settings").findOne({ type: "subscription_pricing" });
      const planPrices = {
        PREMIUM: settings?.premiumPlanPrice || 199,
        ARTIST: settings?.artistProPlanPrice || 299
      };

      const amount = planPrices[requestedPlan as keyof typeof planPrices];
      if (!amount) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      // Create Razorpay order
      try {
        // Validate Razorpay credentials before creating order
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
          
          return res.status(503).json({
            message: "Payment service configuration incomplete. Please contact support."
          });
        }

        // Use a simple short receipt like commerce routes do
        const receipt = `plan_${Date.now().toString().slice(-8)}`; // Simple timestamp-based receipt

        const order = await createOrder(amount, "INR", receipt);

        res.json({
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          planId: requestedPlan,
          key: process.env.RAZORPAY_KEY_ID.trim()
        });
      } catch (razorpayError: any) {
        
        return res.status(503).json({
          message: "Payment service temporarily unavailable. Please try again later or contact support.",
          error: razorpayError.message
        });
      }

    } catch (error) {
      
      res.status(500).json({ message: "Failed to initiate upgrade" });
    }
  });

  // Verify payment and complete upgrade
  app.post("/api/users/me/upgrade/verify", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, paymentId, signature, planId } = req.body;

      if (!orderId || !paymentId || !signature || !planId) {
        return res.status(400).json({
          message: "Missing payment verification data",
          error: "REQUIRED_FIELDS_MISSING"
        });
      }

      

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          error: "USER_NOT_FOUND"
        });
      }

      // Use enhanced payment verification with tracking
      const verificationResult = await verifyPaymentWithTracking(orderId, paymentId, signature, planId);

      // If payment is still processing, return appropriate response
      if (!verificationResult.success) {
        return res.status(202).json({
          message: verificationResult.message || "Payment is still being processed",
          status: "processing",
          orderId,
          paymentId,
          planId
        });
      }

      // Payment successful - update user plan
      const renewsAt = new Date();
      renewsAt.setMonth(renewsAt.getMonth() + 1);

      const planUpdate: any = {
        plan: {
          type: planId,
          renewsAt,
          paymentId,
          subscriptionId: undefined // For future subscription management
        }
      };

      // If upgrading to ARTIST plan, also change role from fan to artist
      if (planId === "ARTIST" && user.role === "fan") {
        planUpdate.role = "artist";
      }

      // Create order record for the platform subscription purchase
      const settings = await storage.db.collection("system_settings").findOne({ type: "subscription_pricing" });
      const planPrices = {
        PREMIUM: settings?.premiumPlanPrice || 199,
        ARTIST: settings?.artistProPlanPrice || 299
      };
      
      const orderData = {
        userId: req.user!.id,
        type: "subscription",
        status: "completed",
        items: [{
          type: "plan",
          name: `${planId} Plan`,
          price: planPrices[planId as keyof typeof planPrices],
          quantity: 1
        }],
        total: planPrices[planId as keyof typeof planPrices],
        paymentId,
        orderId,
        planType: planId
      };

      // Create transaction record for analytics
      const transactionData = {
        userId: req.user!.id,
        amount: planPrices[planId as keyof typeof planPrices],
        currency: "INR",
        status: "completed",
        type: "subscription",
        description: `Platform ${planId} Plan Subscription`,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        planType: planId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await Promise.all([
        storage.createOrder(orderData),
        storage.db.collection("transactions").insertOne(transactionData)
      ]);
      await storage.updateUser(req.user!.id, planUpdate);

      // Get updated user data
      const updatedUser = await storage.getUser(req.user!.id);

      // Generate new JWT token with updated role
      let newToken: string;
      try {
        newToken = jwt.sign(
          { userId: updatedUser!._id, email: updatedUser!.email, role: updatedUser!.role, name: updatedUser!.name },
          process.env.SESSION_SECRET || "your-secret-key-here",
          { expiresIn: "24h" },
        );
      } catch (jwtError: any) {
        
        throw new Error("Failed to generate authentication token");
      }

      

      res.json({
        message: "Plan upgraded successfully",
        plan: {
          type: planId,
          renewsAt
        },
        user: {
          id: updatedUser!._id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role,
          plan: updatedUser!.plan,
          favorites: updatedUser!.favorites,
          following: updatedUser!.following,
          avatarUrl: updatedUser!.avatarUrl,
        },
        token: newToken, // Send new token with updated role
        paymentDetails: verificationResult.paymentDetails
      });

    } catch (error: any) {
      

      // Provide user-friendly error messages based on error type
      let statusCode = 500;
      let errorMessage = "Payment verification failed";
      let errorCode = "VERIFICATION_FAILED";

      if (error.message?.includes("Payment signature verification failed")) {
        statusCode = 400;
        errorMessage = "Payment verification failed. Please contact support if you were charged.";
        errorCode = "SIGNATURE_VERIFICATION_FAILED";
      } else if (error.message?.includes("Payment failed")) {
        statusCode = 400;
        errorMessage = error.message;
        errorCode = "PAYMENT_FAILED";
      } else if (error.message?.includes("timed out")) {
        statusCode = 408;
        errorMessage = "Payment verification is taking longer than expected. Please check your payment status in a few minutes.";
        errorCode = "VERIFICATION_TIMEOUT";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        statusCode = 503;
        errorMessage = "Network error during payment verification. Please try again.";
        errorCode = "NETWORK_ERROR";
      }

      res.status(statusCode).json({
        message: errorMessage,
        error: errorCode,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Check payment status for recovery
  app.get("/api/users/me/payment-status/:orderId/:paymentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, paymentId } = req.params;

      if (!orderId || !paymentId) {
        return res.status(400).json({ message: "Order ID and Payment ID are required" });
      }

      const paymentStatusInfo = getPaymentStatus(orderId, paymentId);

      if (!paymentStatusInfo) {
        return res.status(404).json({
          message: "Payment status not found. This payment may be too old or doesn't exist.",
          status: "not_found"
        });
      }

      // If payment was completed, check if user actually has the plan
      if (paymentStatusInfo.status === 'completed') {
        const user = await storage.getUser(req.user!.id);
        if (user && user.plan?.type?.toUpperCase() === paymentStatusInfo.planId) {
          return res.json({
            status: "completed",
            message: "Payment completed successfully",
            planId: paymentStatusInfo.planId,
            userPlan: user.plan
          });
        } else {
          // Payment completed but user doesn't have the plan - possible sync issue
          
          return res.status(206).json({
            status: "completed_but_not_synced",
            message: "Payment was successful but your account hasn't been updated yet. Please contact support.",
            planId: paymentStatusInfo.planId
          });
        }
      }

      res.json({
        status: paymentStatusInfo.status,
        attempts: paymentStatusInfo.attempts,
        lastAttempt: paymentStatusInfo.lastAttempt,
        planId: paymentStatusInfo.planId,
        message: paymentStatusInfo.status === 'failed'
          ? "Payment verification failed. Please try again or contact support."
          : paymentStatusInfo.status === 'processing'
          ? "Payment is still being processed. Please wait..."
          : "Payment status unknown"
      });

    } catch (error: any) {
      
      res.status(500).json({
        message: "Unable to check payment status. Please try again or contact support.",
        error: error.message
      });
    }
  });

  // Create return request
  app.post("/api/users/me/returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, items, reason } = req.body;

      if (!orderId || !items || !reason) {
        return res.status(400).json({ message: "Order ID, items, and reason are required" });
      }

      // Validate order exists and belongs to user
      const order = await storage.getOrder(orderId);
      if (!order || order.userId.toString() !== req.user!.id) {
        return res.status(403).json({ message: "Order not found or access denied" });
      }

      // Check if order can be returned (within 30 days for digital goods, 7 days for physical)
      const orderDate = new Date(order.createdAt);
      const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);

      let canReturn = false;
      if (items.some((item: any) => item.type === 'merchandise')) {
        // Physical merchandise - 30 days
        canReturn = daysSinceOrder <= 30;
      } else {
        // Digital goods/subscriptions - 7 days
        canReturn = daysSinceOrder <= 7;
      }

      if (!canReturn) {
        return res.status(400).json({
          message: "Return period has expired",
          daysSinceOrder: Math.floor(daysSinceOrder)
        });
      }

      // Calculate refund amount
      let totalRefundAmount = 0;
      for (const item of items) {
        if (item.type === 'merchandise' && item.quantity && item.price) {
          totalRefundAmount += item.quantity * item.price;
        } else if (item.type === 'subscription') {
          // Pro-rate subscription refund
          const remainingDays = Math.max(0, 30 - Math.floor(daysSinceOrder));
          totalRefundAmount += (item.price * remainingDays) / 30;
        }
      }

      // Create return request
      const returnRequest = await storage.createReturnRequest({
        orderId,
        userId: req.user!.id,
        items: items.map((item: any) => ({
          merchId: item.merchId || item.itemId,
          quantity: item.quantity || 1,
          reason: item.reason || reason,
          condition: item.condition || 'NEW'
        })),
        status: 'REQUESTED',
        reason,
        refundAmount: totalRefundAmount,
        refundMethod: 'ORIGINAL_PAYMENT',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.status(201).json({
        message: "Return request created successfully",
        returnRequest: {
          _id: returnRequest._id,
          orderId: returnRequest.orderId,
          status: returnRequest.status,
          refundAmount: totalRefundAmount,
          items: returnRequest.items,
          createdAt: returnRequest.createdAt
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's return requests
  app.get("/api/users/me/returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
  const returnRequests = await storage.getReturnRequestsByUser(req.user!.id);

      // Enrich with order information
      const enrichedReturns = await Promise.all(
        returnRequests.map(async (returnReq: any) => {
          const order = await storage.getOrder(returnReq.orderId);
          return {
            ...returnReq,
            order: order ? {
              _id: order._id,
              totalAmount: order.totalAmount,
              currency: order.currency,
              createdAt: order.createdAt
            } : null
          };
        })
      );

      res.json(enrichedReturns);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete user account
  app.delete("/api/users/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user from database
      await storage.deleteUser(req.user!.id);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Avatar upload
  app.post("/api/users/me/avatar", authenticateToken, upload.single("avatar"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Avatar file required" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (5MB max)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "File size must be less than 5MB" });
      }

      try {
        const avatarResult = await uploadImage(
          req.file.buffer,
          `avatar_${req.user!.id}`,
          "ruc/avatars"
        );

        const avatarUrl = (avatarResult as any).secure_url;

        // Update user profile with avatar URL
        await storage.updateUser(req.user!.id, { avatarUrl });

        res.json({
          message: "Avatar uploaded successfully",
          avatarUrl: avatarUrl,
        });
      } catch (uploadError: any) {
        
        throw uploadError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      
      if (error.message?.includes("Cloudinary not configured")) {
        res.status(503).json({ message: "File upload service not configured. Please contact administrator." });
      } else if (error.message?.includes("Upload timeout")) {
        res.status(408).json({ message: "Upload timeout. Please try again." });
      } else {
        res.status(500).json({ message: "Failed to upload avatar. Please try again." });
      }
    }
  });

  // Get user bank details (artist only)
  app.get("/api/users/me/bank-details", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== "artist") {
        return res.status(403).json({ message: "Only artists can access bank details" });
      }

      const bankDetails = user.artist?.bankDetails;
      
      // Return bank details with masked sensitive fields for security
      res.json({
        accountNumber: bankDetails?.accountNumber ? bankDetails.accountNumber.replace(/\d(?=\d{4})/g, "*") : undefined,
        ifscCode: bankDetails?.ifscCode,
        accountHolderName: bankDetails?.accountHolderName,
        bankName: bankDetails?.bankName,
        phoneNumber: bankDetails?.phoneNumber,
        panNumber: bankDetails?.panNumber ? bankDetails.panNumber.replace(/(?<=^.{2}).*(?=.{2}$)/g, "*****") : undefined,
        aadharNumber: bankDetails?.aadharNumber ? bankDetails.aadharNumber.replace(/\d(?=\d{4})/g, "*") : undefined,
        verified: bankDetails?.verified || false
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user bank details (artist only)
  app.put("/api/users/me/bank-details", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountNumber, ifscCode, accountHolderName, bankName, phoneNumber, panNumber, aadharNumber } = req.body;

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== "artist") {
        return res.status(403).json({ message: "Only artists can update bank details" });
      }

      // Validate required fields
      if (!accountNumber || !ifscCode || !accountHolderName || !phoneNumber || !panNumber || !aadharNumber) {
        return res.status(400).json({ message: "All fields marked with * are required" });
      }

      // Validate IFSC code format
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode)) {
        return res.status(400).json({ message: "Invalid IFSC code format" });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ message: "Please enter a valid 10-digit phone number" });
      }

      // Validate PAN number format
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber)) {
        return res.status(400).json({ message: "Please enter a valid PAN number" });
      }

      // Validate Aadhar number format
      const aadharRegex = /^[0-9]{12}$/;
      if (!aadharRegex.test(aadharNumber)) {
        return res.status(400).json({ message: "Please enter a valid 12-digit Aadhar number" });
      }

      // Update bank details
      const currentArtist = user.artist || {};
      const updatedBankDetails = {
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        accountHolderName,
        bankName: bankName || "",
        phoneNumber,
        panNumber: panNumber.toUpperCase(),
        aadharNumber,
        verified: false // Reset verification when details are updated
      };

      await storage.updateUser(req.user!.id, {
        artist: {
          ...currentArtist,
          bankDetails: updatedBankDetails
        }
      });

      res.json({
        message: "Bank details updated successfully",
        bankDetails: {
          ...updatedBankDetails,
          accountNumber: accountNumber.replace(/\d(?=\d{4})/g, "*") // Return masked account number
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Analytics endpoint for fan dashboard
  app.get("/api/analytics/users/:userId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      // Ensure user can only access their own analytics
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's orders for spending analysis
      const orders = await storage.getOrdersByUser(userId);
      const subscriptions = await storage.getSubscriptionsByUser(userId);
      
      // Calculate analytics from available data
      const totalRevenue = orders
        .filter(order => order.status === 'PAID')
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0) +
        subscriptions
        .filter(sub => sub.active)
        .reduce((sum, sub) => sum + (sub.amount || 0), 0);

      const totalPurchases = orders.filter(order => order.status === 'PAID').length;
      const totalSubscriptions = subscriptions.filter(sub => sub.active).length;

      // Basic analytics based on user data
      const analytics = {
        totalPlays: Math.floor(Math.random() * 100) + totalPurchases * 10, // Simulated for now
        totalLikes: user.favorites?.songs?.length || 0,
        totalRevenue: totalRevenue,
        totalPurchases: totalPurchases,
        totalSubscriptions: totalSubscriptions,
        sessionCount: Math.floor(Math.random() * 50) + 10, // Simulated
        listeningHours: Math.floor(Math.random() * 100) + totalPurchases * 5, // Simulated
        totalSearches: Math.floor(Math.random() * 30) + 5, // Simulated
        totalFollows: user.following?.length || 0,
        favoriteGenres: ["Pop", "Rock", "Jazz"], // Could be enhanced with real data
        period: `${days} days`
      };

      res.json(analytics);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

