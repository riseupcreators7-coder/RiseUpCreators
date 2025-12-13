import { useState } from "react";
import { Heart, Play, Music, User, Calendar, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { useLocation } from "wouter";

export default function Favorites() {
  const auth = useRequireAuth();
  const { play, addToQueue } = useMusicPlayer();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: favorites, isLoading } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/favorites", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch favorites");
      return response.json();
    },
    enabled: !!auth.user,
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'song' | 'artist' | 'event' | 'merch', id: string }) => {
      const endpoint = type === 'song' ? `/api/songs/${id}/like` :
                     type === 'artist' ? `/api/artists/${id}/follow` :
                     type === 'event' ? `/api/events/${id}/favorite` :
                     `/api/merch/${id}/favorite`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to remove from favorites");
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Removed from favorites",
        description: `${variables.type} removed from your favorites`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/favorites"] });
    }
  });

  const playFavoriteSongs = () => {
    if (favorites?.songs && favorites.songs.length > 0) {
      play(favorites.songs[0]);
      if (favorites.songs.length > 1) {
        addToQueue(favorites.songs.slice(1));
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!auth.user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading your favorites..." />
      </div>
    );
  }

  const favoriteSongs = favorites?.songs || [];
  const favoriteArtists = favorites?.artists || [];
  const favoriteEvents = favorites?.events || [];
  const favoriteMerch = favorites?.merch || [];

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container-custom py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Heart className="w-8 h-8 mr-3 text-primary fill-primary" />
              Your Favorites
            </h1>
            <p className="text-muted-foreground">Your collection of liked songs, artists, and events</p>
          </div>

          {favoriteSongs.length > 0 && (
            <Button
              onClick={playFavoriteSongs}
              className="bg-primary hover:bg-primary/80 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Play All Songs
            </Button>
          )}
        </div>

        <Tabs defaultValue="songs" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="songs" className="flex items-center space-x-2">
              <Music className="w-4 h-4" />
              <span>Songs ({favoriteSongs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="artists" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Artists ({favoriteArtists.length})</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Events ({favoriteEvents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="merch" className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Merch ({favoriteMerch.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Favorite Songs */}
          <TabsContent value="songs" className="mt-8">
            {favoriteSongs.length > 0 ? (
              <div className="space-y-3">
                {favoriteSongs.map((song: any, index: number) => (
                  <Card key={song._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden">
                          <img
                            src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"}
                            alt={song.title}
                            className="w-16 h-16 rounded-lg object-cover shadow-md cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/song/${song._id}`);
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLocation(`/song/${song._id}`)}
                          >
                            {song.title}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {song.artistName || "Unknown Artist"}
                          </p>
                        </div>

                        <Badge variant="secondary">{song.genre}</Badge>

                        <div className="text-sm text-muted-foreground">
                          {formatDuration(song.durationSec)}
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => play(song)}
                            className="hover:bg-primary hover:text-white"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFavoriteMutation.mutate({ type: 'song', id: song._id })}
                            className="hover:bg-destructive hover:text-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-16">
                <CardContent>
                  <Music className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-semibold mb-3">No favorite songs yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start liking songs to build your personal collection
                  </p>
                  <Button onClick={() => setLocation("/discover")}>
                    Discover Music
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Favorite Artists */}
          <TabsContent value="artists" className="mt-8">
            {favoriteArtists.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteArtists.map((artist: any) => (
                  <Card key={artist._id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email}`}
                          alt={artist.name}
                          className="w-16 h-16 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-semibold text-lg truncate hover:text-primary transition-colors"
                            onClick={() => setLocation(`/artist/${artist._id}`)}
                          >
                            {artist.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {artist.followers?.length || 0} followers
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {artist.totalPlays?.toLocaleString() || 0} total plays
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFavoriteMutation.mutate({ type: 'artist', id: artist._id })}
                          className="hover:bg-destructive hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-16">
                <CardContent>
                  <User className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-semibold mb-3">No favorite artists yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Follow artists to support them and stay updated with their content
                  </p>
                  <Button onClick={() => setLocation("/discover")}>
                    Discover Artists
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Favorite Events */}
          <TabsContent value="events" className="mt-8">
            {favoriteEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteEvents.map((event: any) => (
                  <Card key={event._id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="relative h-48 rounded-t-lg overflow-hidden">
                        <img
                          src={event.imageUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200"}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <Badge className="absolute top-4 right-4 bg-primary text-white">
                          {new Date(event.date) < new Date() ? 'PAST' : 'UPCOMING'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFavoriteMutation.mutate({ type: 'event', id: event._id })}
                          className="absolute top-4 left-4 bg-black/50 hover:bg-destructive text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="p-4">
                        <h3
                          className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setLocation(`/event/${event._id}`)}
                        >
                          {event.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          by {event.artistName || "Artist"}
                        </p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2" />
                            {event.location}
                          </div>
                        </div>
                        <div className="mt-4">
                          <span className="text-lg font-bold text-primary">₹{event.ticketPrice}</span>
                          <span className="text-sm text-muted-foreground ml-1">onwards</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-16">
                <CardContent>
                  <Calendar className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-semibold mb-3">No favorite events yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Save events you're interested in to keep track of them
                  </p>
                  <Button onClick={() => setLocation("/events")}>
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Favorite Merch */}
          <TabsContent value="merch" className="mt-8">
            {favoriteMerch.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteMerch.map((item: any) => (
                  <Card key={item._id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="relative h-48 rounded-t-lg overflow-hidden">
                        <img
                          src={item.images?.[0] || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=200"}
                          alt={item.name}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLocation(`/merch/${item._id}`)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFavoriteMutation.mutate({ type: 'merch', id: item._id })}
                          className="absolute top-4 right-4 bg-black/50 hover:bg-destructive text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Badge className="absolute bottom-4 right-4 bg-black/70 text-white">
                          {item.category}
                        </Badge>
                      </div>

                      <div className="p-4">
                        <h3
                          className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setLocation(`/merch/${item._id}`)}
                        >
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          by {item.artistName || "Artist"}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-primary">₹{item.price}</span>
                          <Badge variant={item.stock > 0 ? "secondary" : "destructive"}>
                            {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-16">
                <CardContent>
                  <ShoppingBag className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-semibold mb-3">No favorite merch yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Save merchandise items you're interested in to keep track of them
                  </p>
                  <Button onClick={() => setLocation("/merch")}>
                    Browse Merch
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}