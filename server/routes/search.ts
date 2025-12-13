import type { Express } from "express";
import { storage } from "../storage";

export function setupSearchRoutes(app: Express) {
  // Global search endpoint - searches across all content types
  app.get("/api/search", async (req, res) => {
    try {
      const { q, type, limit = 10 } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }

      const limitNum = typeof limit === "string" ? parseInt(limit as string, 10) || 10 : Number(limit) || 10;

      // If specific type is requested, search only that type
      if (type && typeof type === "string") {
        switch (type) {
          case "songs":
            const songs = await storage.searchSongs(q);
            return res.json({
              songs: songs.slice(0, limitNum),
              total: songs.length
            });

          case "artists":
            const artists = await storage.searchArtists(q);
            return res.json({
              artists: artists.slice(0, limitNum),
              total: artists.length
            });

          case "merch":
            const merch = await storage.searchMerch(q);
            return res.json({
              merch: merch.slice(0, limitNum),
              total: merch.length
            });

          case "events":
            const events = await storage.searchEvents(q);
            return res.json({
              events: events.slice(0, limitNum),
              total: events.length
            });

          case "blogs":
            const blogs = await storage.searchBlogs(q);
            return res.json({
              blogs: blogs.slice(0, limitNum),
              total: blogs.length
            });

          default:
            return res.status(400).json({ message: "Invalid search type" });
        }
      }

      // Global search - search all content types in parallel
      const [
        songs,
        artists,
        merch,
        events,
        blogs
      ] = await Promise.all([
        storage.searchSongs(q),
        storage.searchArtists(q),
        storage.searchMerch(q),
        storage.searchEvents(q),
        storage.searchBlogs(q)
      ]);

      // Return results with limited items per type
      res.json({
        songs: songs.slice(0, limitNum),
        artists: artists.slice(0, limitNum),
        merch: merch.slice(0, limitNum),
        events: events.slice(0, limitNum),
        blogs: blogs.slice(0, limitNum),
        totals: {
          songs: songs.length,
          artists: artists.length,
          merch: merch.length,
          events: events.length,
          blogs: blogs.length
        }
      });

    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Quick search suggestions endpoint
  app.get("/api/search/suggestions", async (req, res) => {
    try {
      const { q, limit = 5 } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }

      const limitNum = typeof limit === "string" ? parseInt(limit, 10) || 5 : Number(limit) || 5;

      // Get quick suggestions from all content types
      const [
        songs,
        artists,
        merch,
        events,
        blogs
      ] = await Promise.all([
        storage.searchSongs(q),
        storage.searchArtists(q),
        storage.searchMerch(q),
        storage.searchEvents(q),
        storage.searchBlogs(q)
      ]);

      // Create suggestions array with type indicators
      const suggestions = [
        ...songs.slice(0, limitNum).map(song => ({
          id: song._id,
          title: song.title,
          type: "song",
          subtitle: song.genre,
          url: `/song/${song._id}`
        })),
        ...artists.slice(0, limitNum).map(artist => ({
          id: artist._id,
          title: artist.name,
          type: "artist",
          subtitle: artist.artist?.bio ? artist.artist.bio.substring(0, 50) + "..." : "Artist",
          url: `/artist/${artist._id}`
        })),
        ...merch.slice(0, limitNum).map(item => ({
          id: item._id,
          title: item.name,
          type: "merch",
          subtitle: `₹${item.price}`,
          url: `/merch/${item._id}`
        })),
        ...events.slice(0, limitNum).map(event => ({
          id: event._id,
          title: event.title,
          type: "event",
          subtitle: event.location,
          url: `/event/${event._id}`
        })),
        ...blogs.slice(0, limitNum).map(blog => ({
          id: blog._id,
          title: blog.title,
          type: "blog",
          subtitle: blog.content.substring(0, 50) + "...",
          url: `/blog/${blog._id}`
        }))
      ];

      res.json({
        suggestions: suggestions.slice(0, limitNum * 2), // Return more suggestions for variety
        totals: {
          songs: songs.length,
          artists: artists.length,
          merch: merch.length,
          events: events.length,
          blogs: blogs.length
        }
      });

    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

