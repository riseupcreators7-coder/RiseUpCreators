// src/components/layout/simple-music-player.tsx
import { useState, useMemo, useCallback, memo, useDeferredValue } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Heart,
  Share2,
  X,
  Plus,
  List,
  Shuffle,
  Repeat,
  ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useAuth } from "@/hooks/use-auth";

// Format time utility
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Memoized Progress Bar Component (isolated to prevent re-renders)
const ProgressBar = memo(({ 
  progress, 
  currentTime, 
  duration, 
  seek, 
  isAd 
}: {
  progress: number;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
  isAd: boolean;
}) => {
  const deferredProgress = useDeferredValue(progress);
  
  return (
    <div className="flex items-center space-x-2 w-full">
      <span className="text-xs text-muted-foreground min-w-[35px] text-right">
        {formatTime(currentTime)}
      </span>
      <Slider
        value={[deferredProgress]}
        max={100}
        step={0.1}
        className={`flex-1 h-1 ${isAd ? 'opacity-75' : ''}`}
        onValueChange={([value]) => {
          if (!isAd && duration > 0) {
            const newTime = (value / 100) * duration;
            seek(newTime);
          }
        }}
        disabled={isAd}
      />
      <span className="text-xs text-muted-foreground min-w-[35px]">
        {formatTime(duration)}
      </span>
    </div>
  );
});

export default function SimpleMusicPlayer() {
  const [, navigate] = useLocation();

  // UI state
  const [showQueue, setShowQueue] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Auth + Player (hooks must be before any conditional return)
  const { user } = useAuth();
  
  // ✅ PERFORMANCE: Split music player state into stable vs frequently updating
  const {
    // Stable state (doesn't change often)
    currentSong,
    isPlaying,
    volume,
    queue,
    shuffle,
    repeat,
    isPlayingAd,
    currentAd,
    
    // Control functions (stable)
    play,
    togglePlayPause,
    setVolume,
    next,
    previous,
    stop,
    seek,
    addToQueue,
    removeFromQueue,
    toggleShuffle,
    toggleRepeat,
    skipAd,
    
    // Frequently updating state (isolated)
    currentTime,
    duration,
    progress,
  } = useMusicPlayer();

  // ✅ PERFORMANCE: Defer frequently updating values
  const deferredCurrentTime = useDeferredValue(currentTime);
  const deferredDuration = useDeferredValue(duration);
  const deferredProgress = useDeferredValue(progress);

  // ✅ PERFORMANCE: Memoize control handlers to prevent re-renders
  const stableTogglePlayPause = useCallback(() => {
    togglePlayPause();
  }, [togglePlayPause]);

  const stableNext = useCallback(() => {
    next();
  }, [next]);

  const stablePrevious = useCallback(() => {
    previous();
  }, [previous]);

  const stableStop = useCallback(() => {
    stop();
  }, [stop]);

  const stableToggleShuffle = useCallback(() => {
    toggleShuffle();
  }, [toggleShuffle]);

  const stableToggleRepeat = useCallback(() => {
    toggleRepeat();
  }, [toggleRepeat]);

  const stableSeek = useCallback((time: number) => {
    seek(time);
  }, [seek]);

  const stableSetVolume = useCallback((vol: number) => {
    setVolume(vol);
  }, [setVolume]);

  // Queries
  const queryClient = useQueryClient();

  const { data: playlists } = useQuery({
    queryKey: ["/api/playlists/mine"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: favorites } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({ name, songs: [currentSong?._id] }),
      });
      if (!response.ok) throw new Error("Failed to create playlist");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Playlist created", description: "Song added to new playlist" });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/mine"] });
      setShowAddToPlaylist(false);
      setNewPlaylistName("");
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistName: string) => {
      const response = await fetch("/api/playlists/add-song", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({ playlistName, songId: currentSong?._id }),
      });
      if (!response.ok) throw new Error("Failed to add to playlist");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Added to playlist", description: "Song added to playlist successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/mine"] });
    },
  });

  // Derived
  const isAd = isPlayingAd && currentAd;
  const displaySong = currentSong;

  const isCurrentSongLiked = useMemo(() => {
    if (!currentSong || !favorites) return false;
    const songs = (favorites as any)?.songs;
    return Array.isArray(songs) && songs.some((s: any) => s._id === currentSong._id);
  }, [currentSong, favorites]);

  const artworkSrc = useMemo(() => {
    if (isAd) {
      return currentAd?.imageUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=56&h=56";
    }
    return displaySong?.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=56&h=56";
  }, [isAd, currentAd, displaySong]);


  const formatTime = (seconds: number) => {
    const s = Number.isFinite(seconds) ? seconds : 0;
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Stable handlers
  const handleLike = useCallback(async () => {
    if (!user || !currentSong) return;
    try {
      const response = await fetch(`/api/songs/${currentSong._id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (response.ok) {
        const { liked } = await response.json();
        toast({
          title: liked ? "Added to favorites" : "Removed from favorites",
          description: liked ? "Song added to your favorites" : "Song removed from your favorites",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/favorites"] });
      }
    } catch {
      // ignore
    }
  }, [user, currentSong, queryClient]);

  const handleShare = useCallback(() => {
    if (navigator.share && currentSong) {
      navigator.share({
        title: currentSong.title,
        text: `Check out "${currentSong.title}" on Rise Up Creators`,
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast({ title: "Link copied", description: "Song link copied to clipboard" });
    }
  }, [currentSong]);

  const handleSeek = useCallback(
    ([value]: number[]) => {
      if (!isAd && duration > 0) {
        const newTime = (value / 100) * duration;
        seek(newTime);
      }
    },
    [isAd, duration, seek]
  );

  const handleSkipAd = useCallback(() => {
    if (!user?.plan || user.plan.type === "FREE") {
      toast({
        title: "Premium Feature",
        description: "Skip Ad is only available for premium users. Upgrade to skip ads!",
        variant: "destructive",
      });
    } else {
      skipAd();
    }
  }, [user?.plan, skipAd]);

  // Safe to conditionally return after all hooks
  if (!currentSong && !isPlayingAd) return null;

  // ✅ PERFORMANCE: Memoized Control Components to prevent re-renders
  const PlayPauseButton = memo(({ size = "default" }: { size?: "default" | "large" }) => (
    <Button
      variant="default"
      size="icon"
      className={`bg-primary hover:bg-primary/90 text-white rounded-full transition-all duration-100 ${
        size === "large" ? "w-12 h-12" : "w-10 h-10"
      }`}
      onClick={stableTogglePlayPause}
    >
      {isPlaying ? (
        <Pause className={size === "large" ? "w-6 h-6" : "w-5 h-5"} />
      ) : (
        <Play className={`${size === "large" ? "w-6 h-6 ml-1" : "w-5 h-5 ml-0.5"}`} />
      )}
    </Button>
  ));

  const ControlButtons = memo(() => (
    <div className="flex items-center space-x-2">
      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={stableToggleShuffle} disabled={isAd}>
        <Shuffle className={`w-4 h-4 ${shuffle ? "text-primary" : "text-muted-foreground"}`} />
      </Button>
      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={stablePrevious} disabled={isAd || queue.length === 0}>
        <SkipBack className="w-4 h-4" />
      </Button>
      <PlayPauseButton />
      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={stableNext} disabled={isAd || queue.length === 0}>
        <SkipForward className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 relative"
        onClick={stableToggleRepeat}
        disabled={isAd}
      >
        <Repeat className={`w-4 h-4 ${repeat !== "none" ? "text-primary" : "text-muted-foreground"}`} />
        {repeat === "one" && (
          <span className="absolute -top-1 -right-1 text-[9px] text-primary font-bold">1</span>
        )}
      </Button>
    </div>
  ));

  const CloseButton = memo(() => (
    <Button
      variant="ghost"
      size="icon"
      title="Close player"
      onClick={stableStop}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors duration-150 w-8 h-8 flex-shrink-0"
    >
      <X className="w-4 h-4" />
    </Button>
  ));


  const MobileMiniBar = memo(function MobileMiniBar() {
    return (
      <Card className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
            {(displaySong || isAd) && (
              <>
                <div className="relative">
                  <img
                    src={artworkSrc}
                    alt={isAd ? currentAd?.title : displaySong?.title}
                    className="w-12 h-12 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=48&h=48";
                    }}
                  />
                  {isAd && (
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded-full font-medium">
                      AD
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate leading-tight">
                    {isAd ? currentAd?.title : displaySong?.title}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {isAd ? "Advertisement" : displaySong?.artistName || "Unknown Artist"}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 transition-none"
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              disabled={isAd || !user}
            >
              <Heart className={`w-4 h-4 ${isCurrentSongLiked ? "fill-primary text-primary" : ""}`} />
            </Button>

            {user && (
              <Dialog open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 transition-none"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isAd}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add to Playlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select a playlist</Label>
                      {playlists && Array.isArray(playlists) && playlists.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {playlists.map((playlist: any) => (
                            <Button
                              key={playlist.name}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => addToPlaylistMutation.mutate(playlist.name)}
                              disabled={addToPlaylistMutation.isPending}
                            >
                              <span className="truncate">{playlist.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {playlist.songs.length} songs
                              </span>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No playlists yet. Create one below.</p>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      <Label htmlFor="playlist-name-mini">Create new playlist</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="playlist-name-mini"
                          placeholder="Enter playlist name..."
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => createPlaylistMutation.mutate(newPlaylistName)}
                          disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                          size="sm"
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full transition-none"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
          </div>
        </div>

        <div className="px-3 pb-1">
          <Slider
            value={[deferredProgress]}
            max={100}
            step={0.1}
            className={`h-1 ${isAd ? "opacity-75" : ""}`}
            onValueChange={handleSeek}
            disabled={isAd}
          />
        </div>
      </Card>
    );
  });


  const MobileFullScreen = memo(function MobileFullScreen() {
    return (
      <div className="md:hidden fixed inset-0 z-50 bg-background">
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
            <ChevronDown className="w-5 h-5" />
          </Button>
          <p className="text-sm font-medium">Now Playing</p>
          <Button variant="ghost" size="icon" onClick={() => stop()} className="hover:bg-red-100 focus:bg-red-100">
            <X className="w-5 h-5 text-red-500" />
          </Button>
        </div>

        <div className="flex flex-col h-full px-6 py-4">
          <div className="flex-1 flex items-center justify-center mb-6">
            <div className="relative w-72 h-72 max-w-[80vw] max-h-[80vw]">
              <img
                src={
                  isAd
                    ? currentAd?.imageUrl ||
                      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300"
                    : displaySong?.artworkUrl ||
                      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300"
                }
                alt={isAd ? currentAd?.title : displaySong?.title}
                className="w-full h-full rounded-lg object-cover shadow-lg"
                onClick={() => {
                  if (isAd && currentAd?.callToAction?.url) {
                    window.open(currentAd.callToAction.url, "_blank");
                    fetch("/api/ads/click", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
                      },
                      body: JSON.stringify({ adId: currentAd._id, adType: "AUDIO", placement: "player" }),
                    }).catch(() => {});
                  } else if (!isAd && displaySong) {
                    navigate(`/song/${displaySong._id}`);
                  }
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300";
                }}
              />
              {isAd && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                  AD
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-2 truncate">{isAd ? currentAd?.title : displaySong?.title}</h2>
            <p className="text-muted-foreground">{isAd ? "Advertisement" : displaySong?.artistName || "Unknown Artist"}</p>
          </div>

          <div className="mb-6">
            <Slider
              value={[deferredProgress]}
              max={100}
              step={0.1}
              className={`h-2 ${isAd ? "opacity-75" : ""}`}
              onValueChange={handleSeek}
              disabled={isAd}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{formatTime(deferredCurrentTime)}</span>
              <span>{formatTime(deferredDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-6 mb-6">
            <Button variant="ghost" size="icon" onClick={toggleShuffle} disabled={isAd} className="w-10 h-10 transition-none">
              <Shuffle className={`w-5 h-5 ${shuffle ? "text-primary" : "text-muted-foreground"}`} />
            </Button>

            <Button variant="ghost" size="icon" onClick={previous} disabled={isAd || queue.length === 0} className="w-12 h-12 transition-none">
              <SkipBack className="w-6 h-6" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className="bg-primary hover:bg-primary/90 text-white rounded-full w-16 h-16 transition-none"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={next} disabled={isAd || queue.length === 0} className="w-12 h-12 transition-none">
              <SkipForward className="w-6 h-6" />
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleRepeat} disabled={isAd} className="w-10 h-10 relative transition-none">
              <Repeat className={`w-5 h-5 ${repeat !== "none" ? "text-primary" : "text-muted-foreground"}`} />
              {repeat === "one" && <span className="absolute -top-1 -right-1 text-[9px] text-primary font-bold">1</span>}
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-6 mb-6">
            <Button variant="ghost" size="icon" onClick={handleLike} disabled={isAd || !user} className="w-12 h-12 transition-none" title="Like song">
              <Heart className={`w-6 h-6 ${isCurrentSongLiked ? "fill-primary text-primary" : ""}`} />
            </Button>

            <Button variant="ghost" size="icon" onClick={handleShare} disabled={isAd} className="w-12 h-12 transition-none" title="Share song">
              <Share2 className="w-6 h-6" />
            </Button>

            <Dialog open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isAd || !user} className="w-12 h-12 transition-none" title="Add to playlist">
                  <Plus className="w-6 h-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add to Playlist</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select a playlist</Label>
                    {playlists && Array.isArray(playlists) && playlists.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {playlists.map((playlist: any) => (
                          <Button
                            key={playlist.name}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => addToPlaylistMutation.mutate(playlist.name)}
                            disabled={addToPlaylistMutation.isPending}
                          >
                            <span className="truncate">{playlist.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{playlist.songs.length} songs</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No playlists yet. Create one below.</p>
                    )}
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <Label htmlFor="playlist-name-full">Create new playlist</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="playlist-name-full"
                        placeholder="Enter playlist name..."
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => createPlaylistMutation.mutate(newPlaylistName)}
                        disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                        size="sm"
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Popover open={showQueue} onOpenChange={setShowQueue}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="w-12 h-12 transition-none" title="View queue">
                  <List className="w-6 h-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Queue</h3>
                  <p className="text-sm text-muted-foreground">{queue.length} songs</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {queue.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No songs in queue</div>
                  ) : (
                    queue.map((song, index) => (
                      <div
                        key={song._id}
                        className={`p-3 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0 ${
                          song._id === displaySong?._id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => play(song)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <img
                              src={song.artworkUrl}
                              alt={song.title}
                              className="w-8 h-8 rounded object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100";
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artistName || "Artist"}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(index);
                              toast({ title: "Removed from queue", description: "Song removed from queue" });
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {isAd && (
            <div className="flex justify-center mb-4">
              <Button variant="outline" onClick={handleSkipAd} className="text-blue-600 border-blue-600 hover:bg-blue-50 px-6 py-2">
                {user?.plan?.type === "FREE" || !user?.plan ? "Skip Ad ⭐" : "Skip Ad"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  });

  // ✅ PERFORMANCE: Isolated Desktop Controls Component
  const DesktopControls = memo(({ 
    isAd, 
    queueLength, 
    isPlaying, 
    repeat, 
    shuffle, 
    onPrev, 
    onNext, 
    onTogglePlay, 
    onRepeat, 
    onShuffle 
  }: {
    isAd: boolean;
    queueLength: number;
    isPlaying: boolean;
    repeat: string;
    shuffle: boolean;
    onPrev: () => void;
    onNext: () => void;
    onTogglePlay: () => void;
    onRepeat: () => void;
    onShuffle: () => void;
  }) => (
    <div className="flex items-center space-x-2">
      <Button variant="ghost" size="icon" className="w-8 h-8 transition-none" onClick={onShuffle} disabled={isAd}>
        <Shuffle className={`w-4 h-4 ${shuffle ? "text-primary" : "text-muted-foreground"}`} />
      </Button>
      <Button variant="ghost" size="icon" className="w-8 h-8 transition-none" onClick={onPrev} disabled={isAd || queueLength === 0}>
        <SkipBack className="w-4 h-4" />
      </Button>
      <Button
        variant="default"
        size="icon"
        className="bg-primary hover:bg-primary/90 text-white rounded-full w-10 h-10 transition-none"
        onClick={onTogglePlay}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="w-8 h-8 transition-none" onClick={onNext} disabled={isAd || queueLength === 0}>
        <SkipForward className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="w-8 h-8 relative transition-none" onClick={onRepeat} disabled={isAd}>
        <Repeat className={`w-4 h-4 ${repeat !== "none" ? "text-primary" : "text-muted-foreground"}`} />
        {repeat === "one" && <span className="absolute -top-1 -right-1 text-[9px] text-primary font-bold">1</span>}
      </Button>
    </div>
  ));

  const DesktopPlayer = memo(function DesktopPlayer() {
    return (
      <Card className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t">
        <div className="flex items-center justify-between p-4">
          {/* Left: Song Info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0 max-w-[300px]">
            {(displaySong || isAd) && (
              <>
                <div className="relative">
                  <img
                    src={artworkSrc}
                    alt={isAd ? currentAd?.title : displaySong?.title}
                    className="w-14 h-14 rounded-md object-cover cursor-pointer"
                    onClick={() => {
                      if (isAd && currentAd?.callToAction?.url) {
                        window.open(currentAd.callToAction.url, "_blank");
                        fetch("/api/ads/click", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
                          },
                          body: JSON.stringify({ adId: currentAd._id, adType: "AUDIO", placement: "player" }),
                        }).catch(() => {});
                      } else if (!isAd && displaySong) {
                        navigate(`/song/${displaySong._id}`);
                      }
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=56&h=56";
                    }}
                  />
                  {isAd && (
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                      AD
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate leading-tight">{isAd ? currentAd?.title : displaySong?.title}</h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {isAd ? "Advertisement" : displaySong?.artistName || "Unknown Artist"}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleLike} disabled={isAd || !user}>
                    <Heart className={`w-4 h-4 ${isCurrentSongLiked ? "fill-primary text-primary" : ""}`} />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Center: Controls + Progress */}
          <div className="flex flex-col items-center space-y-2 flex-1 max-w-[500px]">
            <DesktopControls
              isAd={!!isAd}
              queueLength={queue.length}
              isPlaying={!!isPlaying}
              repeat={repeat}
              shuffle={!!shuffle}
              onPrev={stablePrevious}
              onNext={stableNext}
              onTogglePlay={stableTogglePlayPause}
              onRepeat={stableToggleRepeat}
              onShuffle={stableToggleShuffle}
            />

            <ProgressBar
              progress={deferredProgress}
              currentTime={deferredCurrentTime}
              duration={deferredDuration}
              seek={stableSeek}
              isAd={!!isAd}
            />
          </div>

          {/* Right: Volume & Actions */}
          <div className="flex items-center space-x-1 flex-1 max-w-[300px] justify-end">
            {isAd && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipAd}
                className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs px-3 py-1.5 h-8"
              >
                {user?.plan?.type === "FREE" || !user?.plan ? "Skip Ad ⭐" : "Skip Ad"}
              </Button>
            )}

            <Popover open={showQueue} onOpenChange={setShowQueue}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 transition-none">
                  <List className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Queue</h3>
                  <p className="text-sm text-muted-foreground">{queue.length} songs</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {queue.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No songs in queue</div>
                  ) : (
                    queue.map((song, index) => (
                      <div
                        key={song._id}
                        className={`p-3 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0 ${song._id === displaySong?._id ? "bg-primary/10" : ""}`}
                        onClick={() => play(song)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <img
                              src={song.artworkUrl}
                              alt={song.title}
                              className="w-8 h-8 rounded object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100";
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artistName || "Artist"}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(index);
                              toast({ title: "Removed from queue", description: "Song removed from queue" });
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="hidden lg:flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[volume * 100]}
                max={100}
                step={1}
                className="w-24 h-1"
                onValueChange={([value]) => setVolume(value / 100)}
              />
            </div>

            <div className="flex items-center space-x-1 ml-2">
              <Button variant="ghost" size="icon" onClick={handleShare} disabled={isAd} title="Share song" className="transition-none">
                <Share2 className="w-4 h-4" />
              </Button>

              {user && (
                <Dialog open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Add to playlist" disabled={isAd} className="transition-none">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add to Playlist</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select a playlist</Label>
                        {playlists && Array.isArray(playlists) && playlists.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {playlists.map((playlist: any) => (
                              <Button
                                key={playlist.name}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => addToPlaylistMutation.mutate(playlist.name)}
                                disabled={addToPlaylistMutation.isPending}
                              >
                                <span className="truncate">{playlist.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{playlist.songs.length} songs</span>
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4">No playlists yet. Create one below.</p>
                        )}
                      </div>

                      <div className="space-y-3 border-t pt-4">
                        <Label htmlFor="playlist-name">Create new playlist</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="playlist-name"
                            placeholder="Enter playlist name..."
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => createPlaylistMutation.mutate(newPlaylistName)}
                            disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                            size="sm"
                          >
                            Create
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Close Player */}
              <Button
                variant="ghost"
                size="icon"
                title="Close player"
                onClick={stableStop}
                className="w-8 h-8 text-red-500 hover:text-red-600 hover:bg-red-50 transition-none"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  });

  return (
    <>
      {/* Mobile */}
      {!isExpanded && <MobileMiniBar />}
      {isExpanded && <MobileFullScreen />}

      {/* Desktop */}
      <DesktopPlayer />
    </>
  );
}
