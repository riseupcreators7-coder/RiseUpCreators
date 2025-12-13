import { useState, useEffect } from "react";
import { Search, Filter, TrendingUp, Users, Music, Heart, Play, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import Loading from "@/components/common/loading";
import BannerAd from "@/components/ads/banner-ad";

export default function Discover() {
  const { user } = useAuth();
    const { play, pause, isPlaying, currentSong, addToQueue } = useMusicPlayer();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("songs");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");

  const genres = [
    "All Genres", "Pop", "Rock", "Hip Hop", "Jazz", "Classical", 
    "Electronic", "Country", "R&B", "Reggae", "Folk", "Blues"
  ];

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ type, id, quantity = 1 }: { type: 'merch'; id: string; quantity?: number }) => {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ type, id, quantity })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: "Item has been added to your cart"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive"
      });
    }
  });

  // Get search query from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [location]);

  // Get trending songs
  const { data: trendingSongs = [], isLoading: trendingLoading } = useQuery<any[]>({
    queryKey: ["/api/songs/trending"],
    staleTime: 5 * 60 * 1000,
  });

  // Get featured artists
  const { data: featuredArtists = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["/api/artists/featured"],
    staleTime: 5 * 60 * 1000,
  });

  const featuredArtistsArray = (featuredArtists as any[]) || [];

  // Search songs
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ["/api/songs/search", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/songs/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search songs');
      return response.json();
    },
    enabled: !!searchQuery,
    staleTime: 2 * 60 * 1000,
  });

  // Get all songs for discovery
  const { data: allSongs = [], isLoading: allSongsLoading } = useQuery({
    queryKey: user ? ["/api/songs/discover"] : ["/api/songs"],
    queryFn: async () => {
      const endpoint = user ? "/api/songs/discover" : "/api/songs";
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (user) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('ruc_auth_token')}`;
      }
      
      const response = await fetch(endpoint, { headers });
      if (!response.ok) throw new Error('Failed to fetch songs');
      return response.json();
    },
    enabled: !searchQuery,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allArtists = [], isLoading: allArtistsLoading } = useQuery<any[]>({
    queryKey: ["/api/artists"],
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/discover?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
  };

  const handlePlaySong = (song: any) => {
    // ✅ FIX: Check if song is premium and user doesn't have access
    if (song.visibility === "SUBSCRIBER_ONLY" && (!song.isSubscribed && !song.isPremium)) {
      toast({
        title: "Premium Content",
        description: "Subscribe to this artist to play their premium songs",
        variant: "destructive"
      });
      return;
    }

    // Check if song is locked (for display purposes)
    if (song.isLocked) {
      toast({
        title: "Premium Content", 
        description: "Subscribe to this artist to play their premium songs",
        variant: "destructive"
      });
      return;
    }

    play(song);
  };

  const isLoading = searchQuery ? searchLoading : allSongsLoading;
  const songs = searchQuery ? searchResults : allSongs;

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Discover Music</h1>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search for songs, artists, albums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            <Select value={selectedGenre} onValueChange={handleGenreSelect}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select Genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Featured Content Banner */}
          {featuredArtistsArray.length > 0 && (
            <div className="relative h-64 rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
              <div className="absolute inset-0 bg-black/30"></div>
              <div className="relative z-10 h-full flex items-center justify-between p-8">
                <div className="text-white">
                  <Badge className="mb-2 bg-white/20 text-white border-white/30">Featured Artist</Badge>
                  <h2 className="text-4xl font-bold mb-2">{featuredArtistsArray[0]?.name || 'Featured Artist'}</h2>
                  <p className="text-white/80 mb-4">
                    {featuredArtistsArray[0]?.artist?.bio || 'Discover amazing music from talented artists'}
                  </p>
                  <Button 
                    className="bg-white text-black hover:bg-white/90"
                    onClick={() => setLocation(`/artist/${featuredArtistsArray[0]?._id}`)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Listen Now
                  </Button>
                </div>
                <div className="hidden md:block">
                  <img
                    src={featuredArtistsArray[0]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${featuredArtistsArray[0]?.email || 'featured'}`}
                    alt="Featured Artist"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Seamless Banner Ad Integration for FREE users */}
          {(!user?.plan || user.plan.type === "FREE") && (
            <div className="mb-6">
              <BannerAd
                placement="DISCOVER_FEATURED"
                size="featured"
                className="rounded-xl overflow-hidden border shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Multi-Platform Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
            <TabsTrigger value="songs" className="flex items-center gap-2" data-testid="songs-tab">
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">Music</span>
            </TabsTrigger>
            <TabsTrigger value="artists" className="flex items-center gap-2" data-testid="artists-tab">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Artists</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2" data-testid="trending-tab">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Trending</span>
            </TabsTrigger>
          </TabsList>

          {/* Songs Tab */}
          <TabsContent value="songs" className="mt-8">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loading size="lg" text={searchQuery ? "Searching..." : "Loading songs..."} />
              </div>
            ) : songs && songs.length > 0 ? (
              <div className="space-y-4">
                {songs.map((song: any, index: number) => (
                  <div 
                    key={song._id}
                    className="music-card group cursor-pointer flex items-center space-x-4 p-4"
                    onClick={() => handlePlaySong(song)}
                    data-testid={`song-${index}`}
                  >
                    <div className="relative">
                      <img
                        src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"}
                        alt={song.title}
                        className="w-16 h-16 rounded-lg object-cover shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">{song.title}</h4>
                      <button
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/artist/${song.artistId}`);
                        }}
                      >
                        {song.artistName || "Unknown Artist"}
                      </button>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {song.plays?.toLocaleString() || 0} plays
                        </span>
                        <span className="text-xs text-muted-foreground">{song.genre}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {Math.floor((song.durationSec || 0) / 60)}:{((song.durationSec || 0) % 60).toString().padStart(2, '0')}
                      </span>
                      <Button variant="ghost" size="icon">
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? "No songs found" : "No songs available"}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No songs found for "${searchQuery}". Try a different search term.`
                    : "No songs available at the moment. Check back later!"
                  }
                </p>
              </div>
            )}
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists" className="mt-8">
            {allArtistsLoading ? (
              <div className="flex justify-center py-12">
                <Loading size="lg" text="Loading artists..." />
              </div>
            ) : allArtists && allArtists.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {allArtists.map((artist: any, index: number) => (
                  <div 
                    key={artist._id}
                    className="artist-card group cursor-pointer"
                    onClick={() => {
                      setLocation(`/artist/${artist._id}`);
                    }}
                    data-testid={`artist-card-${index}`}
                  >
                    <div className="relative">
                      <img
                        src={artist.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email || artist.name}`}
                        alt={artist.name}
                        className="w-24 h-24 rounded-full object-cover mx-auto mb-3"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email || artist.name}`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h4 className="font-semibold group-hover:text-primary transition-colors truncate">
                        {artist.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {artist.songsCount || 0} songs • {artist.artist?.followers?.length || 0} followers
                      </p>
                      {artist.artist?.verified && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No artists found</h3>
                <p className="text-muted-foreground">We couldn't find any artists. Check back later!</p>
              </div>
            )}
          </TabsContent>

          {/* Trending Tab */}
          <TabsContent value="trending" className="mt-8">
            {trendingLoading ? (
              <div className="flex justify-center py-12">
                <Loading size="lg" text="Loading trending songs..." />
              </div>
            ) : trendingSongs && trendingSongs.length > 0 ? (
              <div className="space-y-4">
                {trendingSongs.map((song: any, index: number) => (
                  <div 
                    key={song._id}
                    className="music-card group cursor-pointer flex items-center space-x-4 p-4"
                    onClick={() => handlePlaySong(song)}
                    data-testid={`trending-song-${index}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>

                    <div className="relative">
                      <img
                        src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"}
                        alt={song.title}
                        className="w-16 h-16 rounded-lg object-cover shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">{song.title}</h4>
                      <button
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/artist/${song.artistId}`);
                        }}
                      >
                        {song.artistName || "Unknown Artist"}
                      </button>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {song.plays?.toLocaleString() || 0} plays
                        </span>
                        <span className="text-xs text-muted-foreground">{song.genre}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {Math.floor((song.durationSec || 0) / 60)}:{((song.durationSec || 0) % 60).toString().padStart(2, '0')}
                      </span>
                      <Button variant="ghost" size="icon">
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No trending songs</h3>
                <p className="text-muted-foreground">No trending songs available at the moment.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}