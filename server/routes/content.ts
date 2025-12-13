import type { Express } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { storage } from "../storage";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { uploadAudio, uploadImage } from "../services/cloudinary";
import { PlanLimitsController } from "../controllers/plan-limits.ts";
import { AnalyticsService } from "../services/analytics";

// Multer configuration for file uploads (storing files in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Accept image files and audio files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export function setupContentRoutes(app: Express) {
  // ========================================
  // PLATFORM STATS
  // ========================================

  // Get platform statistics
  app.get("/api/stats/platform", async (req, res) => {
    try {
      const [artistsCount, songsCount, fansCount, totalPlays, subscriptionPricing] = await Promise.all([
        storage.getArtistsCount(),
        storage.getSongsCount(),
        storage.getFansCount(),
        storage.getTotalPlays(),
        storage.db.collection("system_settings").findOne({ type: "subscription_pricing" })
      ]);

      const stats = {
        artistsCount,
        songsCount,
        fansCount,
        totalPlays,
        pricing: {
          premiumPlanPrice: subscriptionPricing?.premiumPlanPrice || 199,
          artistProPlanPrice: subscriptionPricing?.artistProPlanPrice || 299
        }
      };

      res.json(stats);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // SONGS ROUTES
  // ========================================

  // Get trending songs
  app.get("/api/songs/trending", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const songs = await storage.getTrendingSongs(limit);

      // Return songs directly since artistName is already stored
      res.json(songs);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get subscription-aware discover content
  app.get("/api/songs/discover", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get user to check subscriptions
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ FIX: Get ALL songs (both public and subscriber-only) for discover
      const allSongs = await storage.db.collection("songs").find({}).sort({ createdAt: -1 }).limit(limit * 2).toArray();

      // ✅ FIX: Get user's active subscriptions from subscriptions collection (not user.subscriptions array)
      const activeSubscriptions = await storage.db.collection("subscriptions").find({
        fanId: new ObjectId(userId),
        active: true,
        endDate: { $gt: new Date() }
      }).toArray();

      const subscribedArtistIds = activeSubscriptions.map(sub => sub.artistId.toString());

      // Filter and prioritize content
      const subscribedContent: any[] = [];
      const publicContent: any[] = [];

      for (const song of allSongs) {
        const songArtistId = song.artistId.toString();
        const isSubscribedToArtist = subscribedArtistIds.includes(songArtistId);
        const isOwnSong = userId === songArtistId;

        // Convert song data to proper format
        const convertedSong = {
          ...song,
          _id: song._id.toString(),
          artistId: songArtistId
        };

        // If user is subscribed to artist OR it's their own song, show all their content
        if (isSubscribedToArtist || isOwnSong) {
          subscribedContent.push({
            ...convertedSong,
            isPremium: song.visibility === "SUBSCRIBER_ONLY",
            isSubscribed: true
          });
        }
        // If not subscribed, only show public content
        else if (song.visibility === "PUBLIC") {
          publicContent.push({
            ...convertedSong,
            isPremium: false,
            isSubscribed: false
          });
        }
      }

      // Prioritize subscribed content first, then public content
      const finalContent = [
        ...subscribedContent.slice(0, Math.floor(limit * 0.7)), // 70% subscribed content
        ...publicContent.slice(0, Math.ceil(limit * 0.3))       // 30% public content
      ].slice(0, limit);

      res.json(finalContent);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get recommended songs
  app.get("/api/songs/recommended", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const songs = await storage.getTrendingSongs(limit);

      const songsWithArtistNames = await Promise.all(
        songs.map(async (song) => {
          const artist = await storage.getArtistByUserId(song.artistId);
          if (artist) {
            return {
              ...song,
              artistName: artist.name || "Unknown Artist",
            };
          }
          return {
            ...song,
            artistName: "Unknown Artist",
          };
        }),
      );

      res.json(songsWithArtistNames);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all songs with search and filter
  app.get("/api/songs", async (req, res) => {
    try {
      const { genre, artistId, search, limit, offset } = req.query;
      const options = {
        genre: genre as string,
        artistId: artistId as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      };

      const songs = await storage.getAllSongs(options);
      res.json(songs);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single song by ID - with subscription check
  app.get("/api/songs/:id", async (req, res) => {
    try {
      const song = await storage.getSong(req.params.id);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      // Get the user if token is provided (but don't require it for public content)
      let user = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
          user = await storage.getUser(decoded.userId);
        } catch (error) {
          // Token invalid but continue for public content
        }
      }

      // ✅ FIX: Check if user can access subscriber-only content
      if (song.visibility === "SUBSCRIBER_ONLY") {
        if (!user) {
          return res.status(401).json({ message: "Authentication required for premium content" });
        }
        
        console.log('🔍 Premium Content Access Check for:', song.title);

        // ✅ FIX: Check if user is subscribed to this artist using subscriptions collection
        const activeSubscriptions = await storage.db.collection("subscriptions").find({
          fanId: new ObjectId(user._id),
          artistId: new ObjectId(song.artistId),
          active: true,
          endDate: { $gt: new Date() }
        }).toArray();

        // Check if user is the artist themselves (handle both string and ObjectId formats)
        const userId = user._id.toString();
        const artistId = song.artistId.toString();
        const isArtistThemselves = userId === artistId;
        
        console.log('🔍 Creator Access Check:', {
          userId,
          artistId,
          isArtistThemselves,
          userRole: user.role
        });

        if (activeSubscriptions.length === 0 && !isArtistThemselves) {
          return res.status(403).json({
            message: "This is premium content. Subscribe to the artist to access it.",
            isPremium: true,
            artistId: song.artistId
          });
        }
      }

      // Get artist information
      const artist = await storage.getArtistByUserId(song.artistId);
      
      // Calculate favorites-based likes count for accurate display
      let favoritesBasedLikes = 0;
      try {
        // Access database through the storage.db property (from BaseStorage)
        const database = (storage as any).db || (storage as any).userStorage?.db;
        if (database) {
          // Favorites are stored as strings, so we query with string ID
          favoritesBasedLikes = await database.collection("users").countDocuments({
            "favorites.songs": song._id.toString()
          });
        } else {
          // Fallback to stored likes if no database access
          favoritesBasedLikes = song.likes || 0;
        }
      } catch (likesError) {
        console.log('Error calculating favorites-based likes:', likesError);
        // Fallback to stored likes if calculation fails
        favoritesBasedLikes = song.likes || 0;
      }
      
      const songWithArtist = {
        ...song,
        likes: favoritesBasedLikes, // Use favorites-based count instead of stored value
        artistName: artist?.name || "Unknown Artist",
        artistAvatar: (artist as any)?.avatar || null,
        isPremium: song.visibility === "SUBSCRIBER_ONLY",
        isSubscribed: user ? true : false // If they got here, they have access
      };

      res.json(songWithArtist);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload song
  app.post(
    "/api/songs/upload",
    authenticateToken,
    requireRole(["artist"]),
    upload.fields([{ name: "audio" }, { name: "artwork" }]),
    async (req: AuthRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const artist = await storage.getArtistByUserId(req.user.id);
        if (!artist) {
          return res.status(404).json({ message: "Artist profile not found" });
        }

        // Check plan limits
        const planLimits = new PlanLimitsController();
        const canUpload = await planLimits.checkSongUploadLimit(req.user.id);
        if (!canUpload) {
          return res.status(400).json({
            message: "Song upload limit reached for your plan"
          });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.audio || !files.audio[0]) {
          return res.status(400).json({ message: "Audio file is required" });
        }

        // Parse JSON data from FormData
        let songDataParsed;
        try {
          songDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
        } catch (parseError) {
          
          return res.status(400).json({ message: "Invalid song data format" });
        }

        // Upload audio to Cloudinary
        const audioResult = await uploadAudio(files.audio[0].buffer, `song-${Date.now()}`);

        let artworkUrl = null;
        if (files.artwork && files.artwork[0]) {
          const artworkResult = await uploadImage(files.artwork[0].buffer, `artwork-${Date.now()}`);
          artworkUrl = (artworkResult as any).secure_url;
        }

        const songData = {
          title: songDataParsed.title,
          artistId: artist._id,
          artistName: artist.name, // Add artist name
          genre: songDataParsed.genre,
          fileUrl: (audioResult as any).secure_url, // Changed from audioUrl
          artworkUrl: artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", // Default artwork
          durationSec: parseInt(songDataParsed.duration) || 0, // Changed from duration
          visibility: songDataParsed.visibility || "PUBLIC",
          adEnabled: true, // Default value
          plays: 0, // Initialize play count
          playCount: 0, // Alternative play count field
          likes: 0, // Initialize like count
          uniqueListeners: 0, // Initialize unique listeners
          shares: 0, // Initialize share count
          reviews: [] // Initialize reviews array
        };

        const song = await storage.createSong(songData);
        res.status(201).json(song);
      } catch (error) {
        
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Update song
  app.patch("/api/songs/:id", authenticateToken, requireRole(["artist"]), upload.any(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const song = await storage.getSong(req.params.id);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist || song.artistId !== artist._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse JSON data from FormData
      let songDataParsed;
      try {
        songDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
      } catch (parseError) {
        
        return res.status(400).json({ message: "Invalid song data format" });
      }

      // Only include fields that are actually provided in the request
      const updates: any = {};
      if (songDataParsed.title !== undefined) updates.title = songDataParsed.title;
      if (songDataParsed.genre !== undefined) updates.genre = songDataParsed.genre;
      if (songDataParsed.visibility !== undefined) updates.visibility = songDataParsed.visibility;
      if (songDataParsed.description !== undefined) updates.description = songDataParsed.description;

      const updatedSong = await storage.updateSong(req.params.id, updates);
      res.json(updatedSong);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete song
  app.delete("/api/songs/:id", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const song = await storage.getSong(req.params.id);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      // Artists can only delete their own songs
      if (req.user.role === "artist") {
        const artist = await storage.getArtistByUserId(req.user.id);
        if (!artist || song.artistId !== artist._id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteSong(req.params.id);
      res.json({ message: "Song deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced song play tracking with anti-fraud measures
  app.post("/api/songs/:id/play", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const songId = req.params.id;
      const userId = req.user.id;
      const playDuration = req.body.playDuration || 0; // Duration in seconds

      const song = await storage.getSong(songId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      // Validate minimum play duration (30 seconds for valid stream)
      if (playDuration < 30) {
        return res.json({ 
          message: "Play too short", 
          validated: false,
          reason: "Minimum 30 seconds required for valid stream"
        });
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour window

      // Check daily play limit (max 5 plays per user per song per day)
      const todayPlays = await storage.db.collection("play_logs").countDocuments({
        userId: new ObjectId(userId),
        songId: new ObjectId(songId),
        timestamp: { $gte: todayStart }
      });

      if (todayPlays >= 5) {
        return res.json({ 
          message: "Daily play limit reached", 
          validated: false,
          reason: "Maximum 5 plays per day per song reached"
        });
      }

      // Check unique stream window (no duplicate streams within 1 hour)
      const recentPlay = await storage.db.collection("play_logs").findOne({
        userId: new ObjectId(userId),
        songId: new ObjectId(songId),
        timestamp: { $gte: oneHourAgo }
      });

      if (recentPlay) {
        return res.json({ 
          message: "Play too frequent", 
          validated: false,
          reason: "Wait 1 hour between plays for the same song"
        });
      }

      // Log the validated play
      await storage.db.collection("play_logs").insertOne({
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        songId: new ObjectId(songId),
        artistId: new ObjectId(song.artistId),
        playDuration,
        timestamp: now,
        validated: true,
        createdAt: now
      });

      // Update song play count in database
      await storage.db.collection("songs").updateOne(
        { _id: new ObjectId(song._id), plays: { $exists: false } },
        { $set: { plays: 0, playCount: 0, likes: 0 } }
      );
      
      await storage.db.collection("songs").updateOne(
        { _id: new ObjectId(song._id) },
        {
          $inc: {
            playCount: 1,
            plays: 1
          }
        }
      );

      // Update artist's total plays in their profile
      try {
        await storage.db.collection("users").updateOne(
          { _id: new ObjectId(song.artistId), role: "artist" },
          {
            $inc: {
              "artist.totalPlays": 1
            }
          }
        );
      } catch (artistUpdateError) {
        
      }

      // Log analytics
      await AnalyticsService.logPlay(req.user.id, song._id, song.artistId);

      res.json({ 
        message: "Play logged successfully", 
        validated: true,
        playsToday: todayPlays + 1
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Song like endpoint (alias for favorites)
  app.post("/api/songs/:id/like", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const songId = req.params.id;
      const userId = req.user.id;

      // Get current user to check favorites
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const favorites = user.favorites || { songs: [], artists: [], events: [], merch: [] };
      const currentFavorites = Array.isArray(favorites.songs) ? favorites.songs : [];
      const isCurrentlyFavorited = currentFavorites.some((id: any) => id.toString() === songId);
      
      let updatedFavorites;
      if (isCurrentlyFavorited) {
        // Remove from favorites
        updatedFavorites = currentFavorites.filter((id: any) => id.toString() !== songId);
      } else {
        // Add to favorites
        updatedFavorites = [...currentFavorites, songId];
      }

      // Update user favorites
      await storage.updateUser(userId, {
        "favorites.songs": updatedFavorites
      });

      const isNowFavorited = !isCurrentlyFavorited;

      // Update song like count based on actual favorites (more accurate than increment/decrement)
      const song = await storage.getSong(songId);
      if (song) {
        // Count actual unique users who have this song in favorites
        const actualLikes = await storage.db.collection("users").countDocuments({
          "favorites.songs": new ObjectId(songId)
        });

        // Update song with actual like count
        await storage.db.collection("songs").updateOne(
          { _id: new ObjectId(songId) },
          { $set: { likes: actualLikes } }
        );

        // Calculate artist's total likes from all their songs' favorites
        const artistSongs = await storage.db.collection("songs").find({
          artistId: new ObjectId(song.artistId)
        }).toArray();

        const songIds = artistSongs.map(s => new ObjectId(s._id));
        
        // Count unique users who have any of this artist's songs in favorites
        const artistTotalLikes = await storage.db.collection("users").countDocuments({
          "favorites.songs": { $in: songIds }
        });

        // Update artist's total likes
        try {
          await storage.db.collection("users").updateOne(
            { _id: new ObjectId(song.artistId), role: "artist" },
            { $set: { "artist.totalLikes": artistTotalLikes } }
          );
        } catch (artistUpdateError) {
          
        }

        // Log analytics for like/unlike
        if (isNowFavorited) {
          await AnalyticsService.trackSongLike(userId, song._id, song.artistId);
        }
      }

      res.json({ 
        liked: isNowFavorited,
        isNowFavorited,
        message: isNowFavorited ? "Song liked" : "Song unliked"
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Event like endpoint
  app.post("/api/events/:id/like", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const eventId = req.params.id;
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
        liked: isNowFavorited,
        isNowFavorited,
        message: isNowFavorited ? "Event liked" : "Event unliked"
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // BLOGS ROUTES
  // ========================================

  // Get all blogs
  app.get("/api/blogs", async (req, res) => {
    try {
      const blogs = await storage.getAllBlogs();
      res.json(blogs);
    } catch (error) {
      
      res.status(500).json({ message: "Failed to fetch blogs" });
    }
  });

  // Get blogs by artist (for artist dashboard)
  app.get("/api/blogs/artist", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const blogs = await storage.getBlogsByArtist(artist._id);
      res.json(blogs);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });  // Get single blog
  app.get("/api/blogs/:id", async (req, res) => {
    try {
      const blog = await storage.getBlog(req.params.id);
      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }
      res.json(blog);
    } catch (error) {
      
      res.status(500).json({ message: "Failed to fetch blog" });
    }
  });

  // Create blog
  app.post("/api/blogs", authenticateToken, requireRole(["artist"]), upload.single("coverImage"), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      // Parse JSON data from FormData
      let blogDataParsed;
      try {
        blogDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
      } catch (parseError) {
        
        return res.status(400).json({ message: "Invalid blog data format" });
      }

      let coverImageUrl = null;
      if (req.file) {
        const result = await uploadImage(req.file.buffer, `blog-cover-${Date.now()}`);
        coverImageUrl = (result as any).secure_url;
      }

      const blogData = {
        title: blogDataParsed.title,
        content: blogDataParsed.content,
        artistId: artist._id,
        coverImage: coverImageUrl,
        visibility: blogDataParsed.visibility || "PUBLIC",
        images: coverImageUrl ? [coverImageUrl] : [],
        tags: blogDataParsed.tags ? JSON.parse(blogDataParsed.tags) : [],
      };

      const blog = await storage.createBlog(blogData);
      res.status(201).json(blog);
    } catch (error) {
      
      res.status(500).json({ message: "Failed to create blog" });
    }
  });

  // Update blog
  // Update blog
  app.patch("/api/blogs/:id", authenticateToken, requireRole(["artist"]), upload.any(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const blog = await storage.getBlog(req.params.id);
      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist || blog.artistId !== artist._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse JSON data from FormData
      let blogDataParsed;
      try {
        blogDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
      } catch (parseError) {
        
        return res.status(400).json({ message: "Invalid blog data format" });
      }

      // Only include fields that are actually provided in the request
      const updates: any = {};
      if (blogDataParsed.title !== undefined) updates.title = blogDataParsed.title;
      if (blogDataParsed.content !== undefined) updates.content = blogDataParsed.content;
      if (blogDataParsed.visibility !== undefined) updates.visibility = blogDataParsed.visibility;

      const updatedBlog = await storage.updateBlog(req.params.id, updates);
      res.json(updatedBlog);
    } catch (error) {
      
      res.status(500).json({ message: "Failed to update blog" });
    }
  });

  // Delete blog
  app.delete("/api/blogs/:id", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const blog = await storage.getBlog(req.params.id);
      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }

      // Artists can only delete their own blogs
      if (req.user.role === "artist") {
        const artist = await storage.getArtistByUserId(req.user.id);
        if (!artist || blog.artistId !== artist._id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteBlog(req.params.id);
      res.json({ message: "Blog deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to delete blog" });
    }
  });

  // ========================================
  // EVENTS ROUTES
  // ========================================

  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const { artistId, type, startDate, endDate, limit, offset } = req.query;

      const filters = {
        artistId: artistId as string,
        type: type as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      };

      const events = await storage.getAllEventsFiltered(filters);
      
      // Populate artist names for events
      const eventsWithArtistNames = await Promise.all(
        events.map(async (event) => {
          try {
            const artist = await storage.getArtistByUserId(event.artistId);
            return {
              ...event,
              artistName: artist?.name || "Unknown Artist"
            };
          } catch (error) {
            return {
              ...event,
              artistName: "Unknown Artist"
            };
          }
        })
      );

      res.json(eventsWithArtistNames);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get events by artist (for artist dashboard)
  app.get("/api/events/artist", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const events = await storage.getEventsByArtist(artist._id);
      res.json(events);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Populate artist name
      try {
        const artist = await storage.getArtistByUserId(event.artistId);
        const eventWithArtist = {
          ...event,
          artistName: artist?.name || "Unknown Artist"
        };
        res.json(eventWithArtist);
      } catch (error) {
        res.json({
          ...event,
          artistName: "Unknown Artist"
        });
      }
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create event 
  app.post("/api/events", authenticateToken, requireRole(["artist"]), upload.any(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      // Parse JSON data from FormData
      let eventDataParsed;
      try {
        eventDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
      } catch (parseError) {
        
        return res.status(400).json({ message: "Invalid event data format" });
      }

      let posterUrl = null;
      // Find the image file from uploaded files
      const files = req.files as Express.Multer.File[];
      const imageFile = files?.find(file => file.fieldname === 'image');

      if (imageFile) {
        const result = await uploadImage(imageFile.buffer, `event-poster-${Date.now()}`);
        posterUrl = (result as any).secure_url;
      }

      const eventData = {
        title: eventDataParsed.title,
        description: eventDataParsed.description,
        artistId: artist._id,
        date: new Date(eventDataParsed.date || eventDataParsed.startDate), // Support both date and startDate
        location: eventDataParsed.location,
        venue: eventDataParsed.venue,
        onlineUrl: eventDataParsed.onlineUrl,
        ticketPrice: parseFloat(eventDataParsed.ticketPrice || eventDataParsed.price) || 0,
        maxTickets: parseInt(eventDataParsed.capacity || eventDataParsed.maxTickets || eventDataParsed.maxAttendees) || 100,
        ticketsSold: 0,
        imageUrl: posterUrl,
        type: eventDataParsed.type || "LIVE",
        isActive: true
      };

      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update event
  // Update event
  app.patch("/api/events/:id", authenticateToken, requireRole(["artist"]), upload.any(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist || event.artistId !== artist._id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse JSON data from FormData
      let eventDataParsed;
      try {
        eventDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
      } catch (parseError) {
        
        return res.status(400).json({ message: "Invalid event data format" });
      }

      // Only include fields that are actually provided in the request
      const updates: any = {};
      if (eventDataParsed.title !== undefined) updates.title = eventDataParsed.title;
      if (eventDataParsed.description !== undefined) updates.description = eventDataParsed.description;
      if (eventDataParsed.type !== undefined) updates.type = eventDataParsed.type;
      if (eventDataParsed.date !== undefined || eventDataParsed.startDate !== undefined) {
        updates.date = eventDataParsed.date ? new Date(eventDataParsed.date) : eventDataParsed.startDate ? new Date(eventDataParsed.startDate) : undefined;
      }
      if (eventDataParsed.location !== undefined) updates.location = eventDataParsed.location;
      if (eventDataParsed.venue !== undefined) updates.venue = eventDataParsed.venue;
      if (eventDataParsed.onlineUrl !== undefined) updates.onlineUrl = eventDataParsed.onlineUrl;
      if (eventDataParsed.ticketPrice !== undefined || eventDataParsed.price !== undefined) {
        updates.ticketPrice = eventDataParsed.ticketPrice ? parseFloat(eventDataParsed.ticketPrice) : eventDataParsed.price ? parseFloat(eventDataParsed.price) : undefined;
      }
      if (eventDataParsed.maxTickets !== undefined || eventDataParsed.maxAttendees !== undefined) {
        updates.maxTickets = eventDataParsed.maxTickets ? parseInt(eventDataParsed.maxTickets) : eventDataParsed.maxAttendees ? parseInt(eventDataParsed.maxAttendees) : undefined;
      }
      if (eventDataParsed.imageUrl !== undefined) updates.imageUrl = eventDataParsed.imageUrl;
      if (eventDataParsed.isActive !== undefined) updates.isActive = eventDataParsed.isActive;

      const updatedEvent = await storage.updateEvent(req.params.id, updates);
      res.json(updatedEvent);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Artists can only delete their own events
      if (req.user.role === "artist") {
        const artist = await storage.getArtistByUserId(req.user.id);
        if (!artist || event.artistId !== artist._id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.deleteEvent(req.params.id);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // MERCH ROUTES
  // ========================================

  // Get all merch
  app.get("/api/merch", async (req, res) => {
    try {
      const { artistId, category, minPrice, maxPrice, limit, offset } = req.query;

      const filters = {
        artistId: artistId as string,
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      };

      const merch = await storage.getAllMerchFiltered(filters);
      res.json(merch);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get merch by artist (for artist dashboard)
  app.get("/api/merch/artist", authenticateToken, requireRole(["artist"]), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const artist = await storage.getArtistByUserId(req.user.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const merch = await storage.getMerchByArtist(artist._id);
      res.json(merch);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });      // Get single merch item
      app.get("/api/merch/:id", async (req, res) => {
        try {
          const merch = await storage.getMerch(req.params.id);
          if (!merch) {
            return res.status(404).json({ message: "Merch item not found" });
          }
          res.json(merch);
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Create merch item
      app.post("/api/merch", authenticateToken, requireRole(["artist"]), upload.array("images", 5), async (req: AuthRequest, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          const artist = await storage.getArtistByUserId(req.user.id);
          if (!artist) {
            return res.status(404).json({ message: "Artist profile not found" });
          }

          // Parse JSON data from FormData
          let merchDataParsed;
          try {
            merchDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
          } catch (parseError) {
            
            return res.status(400).json({ message: "Invalid merch data format" });
          }

          const files = req.files as Express.Multer.File[];
          const imageUrls: string[] = [];

          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const result = await uploadImage(file.buffer, `merch-${Date.now()}-${i}`);
              imageUrls.push((result as any).secure_url);
            }
          }

          const merchData = {
            name: merchDataParsed.name,
            description: merchDataParsed.description,
            artistId: artist._id,
            artistName: artist.name, // Add artist name here
            category: merchDataParsed.category,
            price: parseFloat(merchDataParsed.price),
            stock: parseInt(merchDataParsed.stock),
            images: imageUrls,
            sizes: Array.isArray(merchDataParsed.sizes) ? merchDataParsed.sizes : 
                   (merchDataParsed.sizes ? JSON.parse(merchDataParsed.sizes) : ["S", "M", "L", "XL", "XXL"]),
            colors: Array.isArray(merchDataParsed.colors) ? merchDataParsed.colors : 
                    (merchDataParsed.colors ? JSON.parse(merchDataParsed.colors) : []),
          };

          const merch = await storage.createMerch(merchData);
          res.status(201).json(merch);
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Update merch item
      app.patch("/api/merch/:id", authenticateToken, requireRole(["artist"]), upload.any(), async (req: AuthRequest, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          const merch = await storage.getMerch(req.params.id);
          if (!merch) {
            return res.status(404).json({ message: "Merch item not found" });
          }

          const artist = await storage.getArtistByUserId(req.user.id);
          if (!artist || merch.artistId !== artist._id) {
            return res.status(403).json({ message: "Access denied" });
          }

          // Parse JSON data from FormData
          let merchDataParsed;
          try {
            merchDataParsed = req.body.data ? JSON.parse(req.body.data) : req.body;
          } catch (parseError) {
            
            return res.status(400).json({ message: "Invalid merch data format" });
          }

          // Only include fields that are actually provided in the request
          const updates: any = {};
          if (merchDataParsed.name !== undefined) updates.name = merchDataParsed.name;
          if (merchDataParsed.description !== undefined) updates.description = merchDataParsed.description;
          if (merchDataParsed.category !== undefined) updates.category = merchDataParsed.category;
          if (merchDataParsed.price !== undefined) updates.price = parseFloat(merchDataParsed.price);
          if (merchDataParsed.stock !== undefined) updates.stock = parseInt(merchDataParsed.stock);
          if (merchDataParsed.sizes !== undefined) updates.sizes = JSON.parse(merchDataParsed.sizes);
          if (merchDataParsed.colors !== undefined) updates.colors = JSON.parse(merchDataParsed.colors);

          const updatedMerch = await storage.updateMerch(req.params.id, updates);
          res.json(updatedMerch);
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Get merchandise cost breakdown for creators
      app.post("/api/merch/cost-breakdown", authenticateToken, async (req: AuthRequest, res) => {
        try {
          if (!req.user || req.user.role !== "artist") {
            return res.status(403).json({ message: "Artist access required" });
          }

          const { sellingPrice } = req.body;

          if (!sellingPrice) {
            return res.status(400).json({ message: "Selling price is required" });
          }

          // Get current cost settings from admin configuration
          const costSettings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
          const defaultCosts = {
            baseCost: 100,
            manufacturingCost: 50,
            shippingCost: 30,
            packagingCost: 20
          };

          const costs = costSettings?.costs || defaultCosts;
          const platformCommission = costSettings?.platformCommission || 10;

          const totalCost = costs.baseCost + costs.manufacturingCost + costs.shippingCost + costs.packagingCost;
          const platformFee = (sellingPrice * platformCommission) / 100;
          const artistNet = sellingPrice - totalCost - platformFee;

          res.json({
            sellingPrice,
            baseCost: costs.baseCost,
            manufacturingCost: costs.manufacturingCost,
            shippingCost: costs.shippingCost,
            packagingCost: costs.packagingCost,
            totalCosts: totalCost,
            platformFee,
            platformCommission,
            artistEarnings: Math.max(0, artistNet),
            profitMargin: artistNet > 0 ? (artistNet / sellingPrice) * 100 : 0,
            recommendedMinPrice: totalCost + platformFee + 50, // Suggest minimum 50 rupees profit
            isViable: artistNet > 0
          });
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Delete merch item
      app.delete("/api/merch/:id", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          const merch = await storage.getMerch(req.params.id);
          if (!merch) {
            return res.status(404).json({ message: "Merch item not found" });
          }

          // Artists can only delete their own merch
          if (req.user.role === "artist") {
            const artist = await storage.getArtistByUserId(req.user.id);
            if (!artist || merch.artistId !== artist._id) {
              return res.status(403).json({ message: "Access denied" });
            }
          }

          await storage.deleteMerch(req.params.id);
          res.json({ message: "Merch item deleted successfully" });
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Merch Reviews
      app.get("/api/merch/:id/reviews", async (req, res) => {
        try {
          const { id } = req.params;
          const reviews = await storage.db.collection("reviews").find({
            entityId: new ObjectId(id),
            entityType: "merch"
          }).sort({ createdAt: -1 }).toArray();

          // Populate user information
          const reviewsWithUsers = await Promise.all(
            reviews.map(async (review) => {
              try {
                const user = await storage.getUser(review.userId);
                return {
                  ...review,
                  userName: user?.name || "Anonymous",
                  userAvatar: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'anonymous'}`
                };
              } catch (error) {
                return {
                  ...review,
                  userName: "Anonymous",
                  userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous"
                };
              }
            })
          );

          res.json(reviewsWithUsers);
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      app.post("/api/merch/:id/reviews", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const { id } = req.params;
          const { rating, comment } = req.body;

          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Validate merch exists
          const merch = await storage.getMerch(id);
          if (!merch) {
            return res.status(404).json({ message: "Merch item not found" });
          }

          // Check if user already reviewed this merch
          const existingReview = await storage.db.collection("reviews").findOne({
            entityId: new ObjectId(id),
            entityType: "merch",
            userId: new ObjectId(req.user.id)
          });

          if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this item" });
          }

          // Validate rating
          if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
          }

          const review = {
            _id: new ObjectId(),
            entityId: new ObjectId(id),
            entityType: "merch",
            userId: new ObjectId(req.user.id),
            rating: parseInt(rating),
            comment: comment || "",
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await storage.db.collection("reviews").insertOne(review);

          // Get user info for response
          const user = await storage.getUser(req.user.id);
          const reviewWithUser = {
            ...review,
            userName: user?.name || "Anonymous",
            userAvatar: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'anonymous'}`
          };

          res.status(201).json(reviewWithUser);
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Delete merch review
      app.delete("/api/merch/:merchId/reviews/:reviewId", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const { merchId, reviewId } = req.params;

          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Find the review
          const review = await storage.db.collection("reviews").findOne({
            _id: new ObjectId(reviewId),
            entityId: new ObjectId(merchId),
            entityType: "merch"
          });

          if (!review) {
            return res.status(404).json({ message: "Review not found" });
          }

          // Check if user owns the review or is admin
          if (review.userId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied" });
          }

          await storage.db.collection("reviews").deleteOne({ _id: new ObjectId(reviewId) });
          res.json({ message: "Review deleted successfully" });
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // Favorite/unfavorite merch
      app.post("/api/merch/:id/favorite", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const { id } = req.params;

          if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Validate merch exists
          const merch = await storage.getMerch(id);
          if (!merch) {
            return res.status(404).json({ message: "Merch item not found" });
          }

          const user = await storage.getUser(req.user.id);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }

          const favorites = user.favorites || { artists: [], songs: [], events: [], merch: [] };
          const isFavorited = favorites.merch?.includes(id);

          if (isFavorited) {
            // Remove from favorites
            await storage.db.collection("users").updateOne(
              { _id: new ObjectId(req.user.id) },
              { $pull: { "favorites.merch": id } } as any
            );
            res.json({ favorited: false, message: "Removed from favorites" });
          } else {
            // Add to favorites
            await storage.db.collection("users").updateOne(
              { _id: new ObjectId(req.user.id) },
              { $addToSet: { "favorites.merch": id } } as any
            );
            res.json({ favorited: true, message: "Added to favorites" });
          }
        } catch (error) {
          
          res.status(500).json({ message: "Internal server error" });
        }
      });

      // ========================================
      // ANALYTICS ROUTES
      // ========================================

      // Track analytics events with token validation
      app.post("/api/analytics/track", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const userId = req.user?.id;
          if (!userId) {
            return res.status(401).json({ message: "Authentication required for analytics" });
          }

          const { event, data } = req.body;

          if (!event || !data) {
            return res.status(400).json({ message: "Event and data are required" });
          }

          // Validate common analytics events
          switch (event) {
            case 'play':
              if (!data.songId) {
                return res.status(400).json({ message: "songId required for play event" });
              }
              await AnalyticsService.logPlay(userId, data.songId, data.artistId);
              break;

            case 'pause':
              break;

            case 'like':
              if (!data.songId) {
                return res.status(400).json({ message: "songId required for like event" });
              }
              break;

            default:
              // Custom event
          }

          res.json({ message: "Analytics event tracked successfully" });
        } catch (error) {
          
          res.status(500).json({ message: "Failed to track analytics event" });
        }
      });

      // Get analytics session info
      app.get("/api/analytics/sessions/current", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const userId = req.user?.id;
          if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Return basic session info
          res.json({
            userId,
            sessionId: `session_${userId}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            authenticated: true
          });
        } catch (error) {
          
          res.status(500).json({ message: "Failed to get session info" });
        }
      });

      // End analytics session
      app.post("/api/analytics/sessions/end", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const userId = req.user?.id;
          if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Log session end
          res.json({ message: "Session ended successfully" });
        } catch (error) {
          
          res.status(500).json({ message: "Failed to end session" });
        }
      });

      // General analytics endpoint that routes based on scope and user role
      app.get("/api/analytics", authenticateToken, async (req: AuthRequest, res) => {
        try {
          const { scope = 'auto', days = '30', artistId, userId } = req.query;
          const user = req.user;
          const numDays = parseInt(days as string);

          if (!user) {
            return res.status(401).json({ message: "Authentication required" });
          }

          // Determine effective scope based on user role and parameters
          let effectiveScope = scope as string;
          if (scope === 'auto') {
            if (user.role === 'admin') {
              effectiveScope = 'platform';
            } else if (user.role === 'artist') {
              effectiveScope = 'artist';
            } else {
              effectiveScope = 'user';
            }
          }

          // Route to appropriate analytics based on scope
          switch (effectiveScope) {
            case 'platform':
              if (user.role !== 'admin') {
                return res.status(403).json({ message: "Admin access required for platform analytics" });
              }

              // Get platform analytics
              const totalUsers = await storage.db.collection("users").countDocuments();
              const artistCount = await storage.db.collection("users").countDocuments({ role: "artist" });
              const fanCount = await storage.db.collection("users").countDocuments({ role: "fan" });
              const totalSongs = await storage.db.collection("songs").countDocuments();
              const totalMerch = await storage.db.collection("merch").countDocuments();
              const totalEvents = await storage.db.collection("events").countDocuments();

              // Revenue calculations
              const allOrders = await storage.db.collection("orders").find({
                status: { $in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] }
              }).toArray();
              const totalOrderRevenue = allOrders.reduce((sum, order) =>
                sum + (order.totalAmount || order.total || 0), 0);

              const subscriptionRevenue = await storage.db.collection("subscriptions").aggregate([
                { $match: { active: true } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
              ]).toArray();

              const totalSubscriptionRevenue = subscriptionRevenue[0]?.total || 0;
              const totalRevenue = totalOrderRevenue + totalSubscriptionRevenue;

              // Get recent activity data for charts
              const dateRange = new Date();
              dateRange.setDate(dateRange.getDate() - numDays);

              const recentOrders = await storage.db.collection("orders").find({
                createdAt: { $gte: dateRange },
                status: { $in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] }
              }).toArray();

              const recentSubscriptions = await storage.db.collection("subscriptions").find({
                startDate: { $gte: dateRange }
              }).toArray();

              return res.json({
                scope: 'platform',
                data: {
                  // Main metrics that the frontend expects
                  totalSignups: totalUsers,
                  dau: Math.floor(totalUsers * 0.1), // Estimate 10% daily active
                  mau: Math.floor(totalUsers * 0.4), // Estimate 40% monthly active
                  retentionRate7d: 75, // Static value for now

                  // Additional platform metrics
                  totalUsers,
                  artistCount,
                  fanCount,
                  totalSongs,
                  totalMerch,
                  totalEvents,
                  totalContent: totalSongs + totalMerch + totalEvents,

                  // Revenue metrics
                  totalRevenue,
                  monthlyRevenue: totalRevenue, // Using total as monthly for now
                  orderRevenue: totalOrderRevenue,
                  subscriptionRevenue: totalSubscriptionRevenue,

                  // Activity metrics
                  recentOrders: recentOrders.length,
                  recentSubscriptions: recentSubscriptions.length,

                  // Nested objects for detailed views
                  users: {
                    total: totalUsers,
                    artists: artistCount,
                    fans: fanCount,
                    growth: 0
                  },
                  content: {
                    songs: totalSongs,
                    merch: totalMerch,
                    events: totalEvents,
                    total: totalSongs + totalMerch + totalEvents
                  },
                  revenue: {
                    total: totalRevenue,
                    orders: totalOrderRevenue,
                    subscriptions: totalSubscriptionRevenue,
                    growth: 0
                  },
                  activity: {
                    orders: recentOrders.length,
                    subscriptions: recentSubscriptions.length,
                    plays: 0
                  },
                  // Chart data
                  trends: {
                    revenue: recentOrders.reduce((acc: Record<string, number>, order) => {
                      const date = new Date(order.createdAt).toDateString();
                      acc[date] = (acc[date] || 0) + (order.totalAmount || order.total || 0);
                      return acc;
                    }, {}),
                    users: {},
                    content: {}
                  }
                }
              });

            case 'artist':
              // Get artist analytics data directly
              const targetArtistId = (artistId || user.id) as string;

              // Get artist data
              const artistData = await storage.getUser(targetArtistId);
              if (!artistData || artistData.role !== 'artist') {
                return res.status(404).json({ message: "Artist not found" });
              }

              // Get artist's songs
              const artistSongs = await storage.db.collection("songs").find({
                artistId: new ObjectId(targetArtistId)
              }).toArray();

              // Get artist's subscriptions
              const artistSubscriptions = await storage.db.collection("subscriptions").find({
                artistId: new ObjectId(targetArtistId)
              }).toArray();

              // Get artist's orders (merch, events)
              const artistOrders = await storage.db.collection("orders").find({
                "items.artistId": targetArtistId
              }).toArray();

              const artistTotalRevenue = artistSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0) +
                artistOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);

              return res.json({
                scope: 'artist',
                data: {
                  // Main metrics that frontend expects
                  totalPlays: 0, // TODO: implement play tracking
                  uniqueListeners: artistSubscriptions.filter(sub => sub.active).length,
                  monthlyRevenue: artistTotalRevenue,
                  newFollowers: artistSubscriptions.length,

                  // Detailed metrics
                  songs: {
                    total: artistSongs.length,
                    totalPlays: 0,
                    totalLikes: 0
                  },
                  subscribers: {
                    total: artistSubscriptions.filter(sub => sub.active).length,
                    totalSubscriptions: artistSubscriptions.length
                  },
                  revenue: {
                    total: artistTotalRevenue,
                    subscriptions: artistSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0),
                    sales: artistOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0)
                  },
                  engagement: {
                    totalPlays: 0,
                    totalLikes: 0,
                    totalComments: 0
                  }
                }
              });

            case 'user':
              // Get user analytics data directly
              const targetUserId = (userId || user.id) as string;

              // Get user data
              const userData = await storage.getUser(targetUserId);
              if (!userData) {
                return res.status(404).json({ message: "User not found" });
              }

              // Get user orders and subscriptions for analytics
              const userOrders = await storage.db.collection("orders").find({
                userId: new ObjectId(targetUserId)
              }).toArray();

              const userSubscriptions = await storage.db.collection("subscriptions").find({
                fanId: new ObjectId(targetUserId)
              }).toArray();

              const totalSpent = userOrders.reduce((sum, order) =>
                sum + (order.totalAmount || order.total || 0), 0);

              const subscriptionSpent = userSubscriptions.reduce((sum, sub) =>
                sum + (sub.amount || 0), 0);

              return res.json({
                scope: 'user',
                data: {
                  totalSpent: totalSpent + subscriptionSpent,
                  totalOrders: userOrders.length,
                  totalSubscriptions: userSubscriptions.length,
                  activeSubscriptions: userSubscriptions.filter(sub => sub.active).length,
                  favoriteGenres: (userData as any).favoriteGenres || [],
                  totalPlays: 0, // TODO: implement play tracking
                  totalLikes: userData.favorites?.songs?.length || 0,
                  sessionCount: 1 // TODO: implement session tracking
                }
              });

            default:
              return res.status(400).json({ message: "Invalid scope" });
          }

        } catch (error) {

          res.status(500).json({ message: "Internal server error" });
        }
      });
    }
