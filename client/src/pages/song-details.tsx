import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Play, Pause, Heart, Share2, Clock, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

export default function SongDetails() {
  const [, params] = useRoute("/song/:id");
  const songId = params?.id;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { play, pause, isPlaying, currentSong } = useMusicPlayer();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useQuery({
    queryKey: ["/api/songs", songId],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/songs/${songId}`, { headers });
      if (!res.ok) throw new Error("Failed to load song");
      return res.json();
    },
    enabled: !!songId,
  });

  const { data: artist } = useQuery({
    queryKey: ["/api/artists", song?.artistId],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/artists/${song.artistId}`, { headers });
      if (!res.ok) throw new Error("Failed to load artist");
      return res.json();
    },
    enabled: !!song?.artistId,
  });

  const { data: relatedSongs } = useQuery({
    queryKey: ["/api/songs/related", songId],
    queryFn: async () => {
      const res = await fetch(`/api/songs?genre=${song?.genre}&limit=6`);
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((s: any) => s._id !== songId);
    },
    enabled: !!song?.genre,
  });

  const { data: favorites } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      if (!token) return null;
      const res = await fetch("/api/users/me/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/songs/${songId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.liked ? "Added to favorites" : "Removed from favorites",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs", songId] });
    },
  });

  const isCurrentSong = currentSong?._id === songId;
  const isPlayingThis = isCurrentSong && isPlaying;
  const isFavorited = favorites?.songs?.some((s: any) => s._id === songId) || false;

  const togglePlay = () => {
    if (isPlayingThis) pause();
    else play(song);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: song.title,
        text: `Listen to "${song.title}" on RiseUp Creators`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (isLoading) return <Loading size="lg" text="Loading song..." />;
  if (!song)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Song not found
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER BANNER */}
      <div
        className="relative h-96 w-full flex items-end justify-start p-8"
        style={{
          backgroundImage: `url(${song.artworkUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-lg"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-end md:items-center gap-6">
          <img
            src={song.artworkUrl}
            alt={song.title}
            className="w-48 h-48 rounded-lg shadow-lg object-cover"
          />
          <div>
            <Badge variant="secondary" className="mb-2">
              {song.genre}
            </Badge>
            <h1 className="text-4xl font-bold mb-3">{song.title}</h1>

            {/* ARTIST PHOTO + NAME */}
            {artist && (
              <div
                className="flex items-center gap-3 cursor-pointer mb-4"
                onClick={() => navigate(`/artist/${artist._id}`)}
              >
                <img
                  src={
                    artist.avatarUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email}`
                  }
                  alt={artist.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="text-lg font-medium hover:text-primary transition-colors">
                  {artist.name}
                </span>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" /> {formatDuration(song.durationSec)}
              </div>
              <div className="flex items-center">
                <Headphones className="w-4 h-4 mr-1" /> {song.plays?.toLocaleString()} plays
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-border">
        <Button size="lg" className="rounded-full px-6" onClick={togglePlay}>
          {isPlayingThis ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
          {isPlayingThis ? "Pause" : "Play"}
        </Button>

        {user && (
          <Button
            variant="ghost"
            onClick={() => toggleFavoriteMutation.mutate()}
            disabled={toggleFavoriteMutation.isPending}
          >
            <Heart
              className={`w-5 h-5 ${
                isFavorited ? "fill-primary text-primary" : "text-muted-foreground"
              }`}
            />
          </Button>
        )}
        <Button variant="ghost" onClick={handleShare}>
          <Share2 className="w-5 h-5" />
        </Button>
      </div>

      {/* RELATED SONGS */}
      {relatedSongs && relatedSongs.length > 0 && (
        <div className="px-8 py-10 max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">More Like This</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {relatedSongs.map((rs: any) => (
              <div
                key={rs._id}
                onClick={() => navigate(`/song/${rs._id}`)}
                className="cursor-pointer rounded-lg bg-muted/20 hover:bg-muted/40 transition p-3"
              >
                <img
                  src={rs.artworkUrl}
                  className="w-full h-40 rounded-md object-cover mb-3"
                  alt={rs.title}
                />
                <p className="font-medium truncate">{rs.title}</p>
                <p className="text-sm text-muted-foreground truncate">{rs.artistName}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
