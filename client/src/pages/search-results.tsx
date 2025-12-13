import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  Search,
  Music,
  User,
  ShoppingBag,
  Calendar,
  FileText,
  Filter,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

export default function SearchResults() {
  const [, params] = useRoute("/search");
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
    const { play, pause, isPlaying, currentSong, addToQueue } = useMusicPlayer();

  // Get search query from URL
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const query = searchParams.get('q') || '';

  // Fetch search results
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query.trim()) return { songs: [], artists: [], merch: [], events: [], blogs: [], totals: {} };

      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
      if (!response.ok) throw new Error('Search failed');

      return response.json();
    },
    enabled: !!query.trim(),
    staleTime: 30 * 1000,
  });

  const handlePlaySong = (song: any) => {
    if (searchResults?.songs) {
      addToQueue(searchResults.songs);
    }
    play(song);

    // Track analytics
    fetch(`/api/songs/${song._id}/play`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
      }
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'song': return <Music className="w-4 h-4" />;
      case 'artist': return <User className="w-4 h-4" />;
      case 'merch': return <ShoppingBag className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'blog': return <FileText className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'song': return 'text-blue-500';
      case 'artist': return 'text-green-500';
      case 'merch': return 'text-purple-500';
      case 'event': return 'text-orange-500';
      case 'blog': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text={`Searching for "${query}"...`} />
      </div>
    );
  }

  if (error || !searchResults) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Search Error</h2>
            <p className="text-muted-foreground">Unable to perform search. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { songs, artists, merch, events, blogs, totals } = searchResults;

  return (
    <div className="min-h-screen pt-16 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
        <div className="container-custom py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Search Results</h1>
              <p className="text-muted-foreground">
                Found {totals.songs + totals.artists + totals.merch + totals.events + totals.blogs} results for "{query}"
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation('/discover')}
              className="flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Clear Search</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container-custom py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="all" className="flex items-center space-x-2">
              <Search className="w-4 h-4" />
              <span>All ({totals.songs + totals.artists + totals.merch + totals.events + totals.blogs})</span>
            </TabsTrigger>
            <TabsTrigger value="songs" className="flex items-center space-x-2">
              <Music className="w-4 h-4" />
              <span>Songs ({totals.songs})</span>
            </TabsTrigger>
            <TabsTrigger value="artists" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Artists ({totals.artists})</span>
            </TabsTrigger>
            <TabsTrigger value="merch" className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Merch ({totals.merch})</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Events ({totals.events})</span>
            </TabsTrigger>
            <TabsTrigger value="blogs" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Blogs ({totals.blogs})</span>
            </TabsTrigger>
          </TabsList>

          {/* All Results Tab */}
          <TabsContent value="all">
            <div className="space-y-8">
              {/* Songs Section */}
              {songs && songs.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                    <Music className="w-6 h-6 text-blue-500" />
                    <span>Songs</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {songs.slice(0, 6).map((song: any) => (
                      <Card key={song._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => handlePlaySong(song)}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60"}
                              alt={song.title}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                            <div className="flex-1">
                              <h4 className="font-semibold truncate">{song.title}</h4>
                              <p className="text-sm text-muted-foreground">{song.genre}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {totals.songs > 6 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('songs')}
                    >
                      View all {totals.songs} songs
                    </Button>
                  )}
                </div>
              )}

              {/* Artists Section */}
              {artists && artists.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                    <User className="w-6 h-6 text-green-500" />
                    <span>Artists</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {artists.slice(0, 6).map((artist: any) => (
                      <Card key={artist._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setLocation(`/artist/${artist._id}`)}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={artist.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email}`} />
                              <AvatarFallback>{artist.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h4 className="font-semibold">{artist.name}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {artist.artist?.bio || 'Artist'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {totals.artists > 6 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('artists')}
                    >
                      View all {totals.artists} artists
                    </Button>
                  )}
                </div>
              )}

              {/* Merch Section */}
              {merch && merch.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                    <ShoppingBag className="w-6 h-6 text-purple-500" />
                    <span>Merchandise</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {merch.slice(0, 8).map((item: any) => (
                      <Card key={item._id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <img
                            src={item.images?.[0] || "https://images.unsplash.com/photo-1521572163474-686449cf17ab?w=200&h=200"}
                            alt={item.name}
                            className="w-full h-32 object-cover rounded-lg mb-3"
                          />
                          <h4 className="font-semibold truncate">{item.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2">₹{item.price}</p>
                          <Button size="sm" className="w-full">View Details</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {totals.merch > 8 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('merch')}
                    >
                      View all {totals.merch} items
                    </Button>
                  )}
                </div>
              )}

              {/* Events Section */}
              {events && events.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                    <Calendar className="w-6 h-6 text-orange-500" />
                    <span>Events</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.slice(0, 4).map((event: any) => (
                      <Card key={event._id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{event.title}</h4>
                              <p className="text-sm text-muted-foreground">{event.location}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(event.date).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="secondary">₹{event.ticketPrice}</Badge>
                          </div>
                          <Button size="sm">Get Tickets</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {totals.events > 4 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('events')}
                    >
                      View all {totals.events} events
                    </Button>
                  )}
                </div>
              )}

              {/* Blogs Section */}
              {blogs && blogs.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                    <FileText className="w-6 h-6 text-red-500" />
                    <span>Blogs</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {blogs.slice(0, 4).map((blog: any) => (
                      <Card key={blog._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setLocation(`/blog/${blog._id}`)}>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">{blog.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {blog.content.replace(/[#*>]/g, '').substring(0, 150)}...
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(blog.createdAt).toLocaleDateString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {totals.blogs > 4 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('blogs')}
                    >
                      View all {totals.blogs} blogs
                    </Button>
                  )}
                </div>
              )}

              {/* No Results */}
              {totals.songs === 0 && totals.artists === 0 && totals.merch === 0 &&
               totals.events === 0 && totals.blogs === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No results found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search terms or browse our content.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Songs Tab */}
          <TabsContent value="songs">
            {songs && songs.length > 0 ? (
              <div className="space-y-4">
                {songs.map((song: any) => (
                  <Card key={song._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handlePlaySong(song)}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <img
                          src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=60&h=60"}
                          alt={song.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{song.title}</h4>
                          <p className="text-sm text-muted-foreground">{song.genre}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {song.plays?.toLocaleString() || 0} plays
                            </span>
                            {song.visibility === 'SUBSCRIBER_ONLY' && (
                              <Badge variant="secondary" className="text-xs">Subscribers Only</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Math.floor((song.durationSec || 0) / 60)}:{((song.durationSec || 0) % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No songs found</h3>
                  <p className="text-muted-foreground">Try searching for different terms.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists">
            {artists && artists.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {artists.map((artist: any) => (
                  <Card key={artist._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setLocation(`/artist/${artist._id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4 mb-4">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={artist.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email}`} />
                          <AvatarFallback className="text-lg">{artist.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-lg font-semibold">{artist.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {artist.artist?.followers?.length || 0} followers
                          </p>
                        </div>
                      </div>
                      {artist.artist?.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {artist.artist.bio}
                        </p>
                      )}
                      <Button className="w-full">View Profile</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No artists found</h3>
                  <p className="text-muted-foreground">Try searching for different terms.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Merch Tab */}
          <TabsContent value="merch">
            {merch && merch.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {merch.map((item: any) => (
                  <Card key={item._id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <img
                        src={item.images?.[0] || "https://images.unsplash.com/photo-1521572163474-686449cf17ab?w=300&h=300"}
                        alt={item.name}
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                      <h4 className="font-semibold mb-1">{item.name}</h4>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">₹{item.price}</span>
                        <Button>Add to Cart</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No merchandise found</h3>
                  <p className="text-muted-foreground">Try searching for different terms.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            {events && events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((event: any) => (
                  <Card key={event._id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                            {event.description}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-primary">
                            {new Date(event.date).getDate()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-2" />
                          {new Date(event.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <span className="w-4 h-4 mr-2">📍</span>
                          {event.location}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold text-primary">₹{event.ticketPrice}</span>
                          <span className="text-sm text-muted-foreground ml-1">onwards</span>
                        </div>
                        <Button
                          className="bg-primary hover:bg-primary/80 text-white"
                          disabled={new Date(event.date) < new Date()}
                        >
                          {new Date(event.date) > new Date() ? 'Get Tickets' : 'Past Event'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No events found</h3>
                  <p className="text-muted-foreground">Try searching for different terms.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Blogs Tab */}
          <TabsContent value="blogs">
            {blogs && blogs.length > 0 ? (
              <div className="space-y-6">
                {blogs.map((blog: any) => (
                  <Card key={blog._id} className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setLocation(`/blog/${blog._id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <FileText className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-xl">{blog.title}</h3>
                            {blog.visibility === "SUBSCRIBER_ONLY" && (
                              <Badge variant="secondary" className="text-xs">
                                Subscribers Only
                              </Badge>
                            )}
                          </div>
                          <div className="prose prose-sm max-w-none mb-4">
                            <p className="text-muted-foreground line-clamp-3">
                              {blog.content.replace(/[#*>]/g, '').substring(0, 200)}...
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>
                              {new Date(blog.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                            {blog.tags && blog.tags.length > 0 && (
                              <div className="flex items-center space-x-1">
                                {blog.tags.slice(0, 3).map((tag: string) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {blog.images && blog.images.length > 0 && (
                          <div className="ml-6">
                            <img
                              src={blog.images[0]}
                              alt={blog.title}
                              className="w-24 h-24 rounded-lg object-cover"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" size="sm">
                          Read More
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No blogs found</h3>
                  <p className="text-muted-foreground">Try searching for different terms.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
