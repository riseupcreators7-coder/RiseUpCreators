import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Play, Users, Music, Calendar, TrendingUp, ChevronDown, Star, Award, Headphones, Mic, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMusicPlayer } from "@/hooks/use-music-player";
import AuthModal from "@/components/auth/auth-modal";
import Loading from "@/components/common/loading";
import type { PlatformStats } from "@/types";

export default function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const { user, isLoading } = useAuth();
  const { play } = useMusicPlayer();
  const [, navigate] = useLocation();

  // Redirect authenticated users to appropriate home
  useEffect(() => {
    if (user) {
      switch (user.role) {
        case "artist":
          navigate("/creator");
          break;
        case "admin":
          navigate("/admin");
          break;
        case "fan":
          navigate("/home");
          break;
      }
    }
  }, [user, navigate]);

  // Don't render anything while auth is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if user is authenticated (will redirect)
  if (user) {
    return null;
  }

  // Fetch featured content
  const { data: featuredArtists, isLoading: artistsLoading } = useQuery({
    queryKey: ["/api/artists/featured"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendingSongs, isLoading: songsLoading } = useQuery({
    queryKey: ["/api/songs/trending", { limit: 6 }],
    staleTime: 5 * 60 * 1000,
  });

  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events"],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch platform stats
  const { data: platformStats, error: statsError, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/stats/platform"],
    staleTime: 15 * 60 * 1000, // Cache for 15 minutes
  });

  // Platform stats handling
  if (statsError) {
    // Error fetching platform stats
  }
  if (platformStats) {
    // Platform stats loaded
  }

  const handleSignup = (role: "fan" | "artist") => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden video-overlay">
        <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-primary/20"></div>

        <div className="relative z-10 text-center max-w-6xl mx-auto px-4 pt-16">
          <div className="floating animate-float">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Empowering Music{" "}
              <span className="text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Creators
              </span>
              ,<br />
              Connecting{" "}
              <span className="text-gradient bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                Fans
              </span>
            </h1>
          </div>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto fade-in delay-200">
            The ultimate platform where artists upload, monetize, and connect with their audience through music, merch, events, and exclusive content.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 fade-in delay-300">
            <Button
              size="lg"
              className="gradient-primary text-primary-foreground px-8 py-4 rounded-2xl font-semibold text-lg hover-glow"
              onClick={() => handleSignup("fan")}
              data-testid="signup-fan-button"
            >
              <Headphones className="w-5 h-5 mr-2" />
              Join as Fan
            </Button>
            <Button
              size="lg"
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-8 py-4 rounded-2xl font-semibold text-lg hover-glow"
              onClick={() => handleSignup("artist")}
              data-testid="signup-artist-button"
            >
              <Mic className="w-5 h-5 mr-2" />
              Upload Your Music
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto fade-in delay-400">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {platformStats?.artistsCount?.toLocaleString() || '0'}+
              </div>
              <div className="text-muted-foreground">Artists</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {platformStats?.songsCount?.toLocaleString() || '0'}+
              </div>
              <div className="text-muted-foreground">Songs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {platformStats?.fansCount?.toLocaleString() || '0'}+
              </div>
              <div className="text-muted-foreground">Fans</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {platformStats?.totalPlays?.toLocaleString() || '0'}+
              </div>
              <div className="text-muted-foreground">Streams</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-primary" />
        </div>
      </section>

      {/* Featured Artists Section */}
      <section className="section-padding bg-surface/20">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="heading-secondary mb-4">Featured Artists</h2>
            <p className="text-xl text-muted-foreground">Discover rising stars and established creators</p>
          </div>

          {artistsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="artist-card animate-pulse">
                  <div className="w-full h-48 bg-muted rounded-xl mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.isArray(featuredArtists) && featuredArtists.slice(0, 6).map((artist: any, index: number) => (
                <Link
                  key={artist._id}
                  href={`/artist/${artist._id}`}
                  className="artist-card group fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`featured-artist-${index}`}
                >
                  <div className="relative mb-4">
                    <img
                      src={artist.avatarUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"}
                      alt={`${artist.name || 'Artist'} profile`}
                      className="w-full h-48 object-cover rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-xl"></div>
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-xl font-bold">{artist.name || 'Artist'}</h3>
                      <p className="text-muted-foreground">Music Artist</p>
                    </div>
                    {artist.artist?.verified && (
                      <Badge className="absolute top-4 right-4 bg-success text-white">
                        <Award className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      className="play-button absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <Users className="w-4 h-4 inline mr-1" />
                      {artist.artist?.followers?.length || 0} followers
                    </div>
                    <Button size="sm" className="bg-primary hover:bg-primary/80 text-white">
                      Follow
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!artistsLoading && (!Array.isArray(featuredArtists) || featuredArtists.length === 0) && (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No featured artists available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Trending Songs Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="heading-secondary mb-4">Trending Now</h2>
              <p className="text-xl text-muted-foreground">Popular tracks this week</p>
            </div>
            <Link href="/discover">
              <Button variant="outline" data-testid="view-all-trending">
                View All
              </Button>
            </Link>
          </div>

          {songsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="music-card animate-pulse">
                  <div className="w-16 h-16 bg-muted rounded-xl mr-4"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(trendingSongs) && trendingSongs.slice(0, 6).map((song: any, index: number) => (
                <div
                  key={song._id}
                  className="music-card group flex items-center space-x-4 fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`trending-song-${index}`}
                  onClick={() => play({
                    _id: song._id,
                    title: song.title,
                    artistName: song.artistName,
                    fileUrl: song.fileUrl,
                    artworkUrl: song.artworkUrl,
                    durationSec: song.durationSec
                  })}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"}
                      alt={song.title}
                      className="w-16 h-16 rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{song.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">{song.artistName || 'Unknown Artist'}</p>
                    <div className="flex items-center mt-1">
                      <div className="music-visualizer mr-2">
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {song.plays?.toLocaleString() || 0} plays
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!songsLoading && (!Array.isArray(trendingSongs) || trendingSongs.length === 0) && (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No trending songs available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="section-padding bg-surface/20">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="heading-secondary mb-4">Upcoming Events</h2>
              <p className="text-xl text-muted-foreground">Don't miss these amazing shows</p>
            </div>
            <Link href="/events">
              <Button variant="outline" data-testid="view-all-events">
                View All Events
              </Button>
            </Link>
          </div>

          {eventsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="event-card animate-pulse">
                  <div className="w-full h-48 bg-muted mb-4"></div>
                  <div className="p-6">
                    <div className="h-6 bg-muted rounded mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.isArray(upcomingEvents) && upcomingEvents.slice(0, 3).map((event: any, index: number) => (
                <Link
                  key={event._id}
                  href={`/event/${event._id}`}
                  className="event-card group fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  data-testid={`upcoming-event-${index}`}
                >
                  <div className="relative">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Show fallback only if actual image fails
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Calendar className="w-6 h-6 mx-auto mb-1 opacity-50" />
                          <p className="text-xs">No Image</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <Badge className="absolute top-4 right-4 bg-primary text-white">
                      LIVE
                    </Badge>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-muted-foreground text-sm">by {event.artistName || 'Artist'}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {new Date(event.date).getDate()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-primary">₹{event.ticketPrice}</span>
                        <span className="text-sm text-muted-foreground ml-1">onwards</span>
                      </div>
                      <Button className="bg-primary hover:bg-primary/80 text-white">
                        Get Tickets
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!eventsLoading && (!Array.isArray(upcomingEvents) || upcomingEvents.length === 0) && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No upcoming events available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="section-padding bg-surface/20">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="heading-secondary mb-4">Choose Your Plan</h2>
            <p className="text-xl text-muted-foreground">Unlock the full potential of Rise Up Creators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="relative">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-muted">
                    <Headphones className="w-8 h-8 text-muted-foreground" />
                  </div>
                </div>
                <CardTitle className="text-2xl mb-2">Free</CardTitle>
                <div className="text-3xl font-bold mb-2">Free</div>
                <p className="text-muted-foreground">Perfect for getting started</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Listen to music</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Create playlists</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Follow artists</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Basic recommendations</span>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-muted flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Ads between songs</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-muted flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Lower audio quality</span>
                  </div>
                </div>
                <div className="pt-6">
                  <Button
                    className="w-full bg-muted text-muted-foreground cursor-not-allowed"
                    disabled
                  >
                    Current Plan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="relative border-primary shadow-lg scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-white px-4 py-1">
                  Most Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Crown className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl mb-2">Premium</CardTitle>
                <div className="text-3xl font-bold mb-2">
                  ₹{platformStats?.pricing?.premiumPlanPrice || 99}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground">The complete music experience</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Ad-free listening</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">High-quality audio (320kbps)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Offline downloads</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Unlimited skips</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Exclusive content access</span>
                  </div>
                </div>
                <div className="pt-6">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => handleSignup("fan")}
                  >
                    Upgrade to Premium
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Artist Pro Plan */}
            <Card className="relative">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-muted">
                    <Star className="w-8 h-8 text-muted-foreground" />
                  </div>
                </div>
                <CardTitle className="text-2xl mb-2">Artist Pro</CardTitle>
                <div className="text-3xl font-bold mb-2">
                  ₹{platformStats?.pricing?.artistProPlanPrice || 299}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground">Everything for creators</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">All Premium features</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Upload unlimited songs</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Advanced analytics dashboard</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Merchandise store</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">Event management tools</span>
                  </div>
                </div>
                <div className="pt-6">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleSignup("artist")}
                  >
                    Start Creating
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Link href="/plans">
              <Button variant="outline" size="lg">
                View All Plans & Details
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="section-padding">
        <div className="container-custom text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Rise Up?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of artists and fans who are already part of the Rise Up Creators community
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="gradient-primary text-primary-foreground px-8 py-4 rounded-2xl font-semibold text-lg hover-glow"
                onClick={() => handleSignup("fan")}
                data-testid="cta-start-journey"
              >
                <Star className="w-5 h-5 mr-2" />
                Start Your Journey
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-muted transition-colors"
                data-testid="cta-watch-demo"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/50 border-t border-border py-12">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img
                  src="/logo.png"
                  alt="Rise Up Creators Logo"
                  className="w-8 h-8 rounded-lg object-contain"
                />
                <span className="text-xl font-bold">Rise Up Creators</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Empowering music creators and connecting fans worldwide.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/discover" className="hover:text-primary transition-colors">Discover Music</Link></li>
                <li><Link href="/events" className="hover:text-primary transition-colors">Browse Events</Link></li>
                <li><Link href="/merch" className="hover:text-primary transition-colors">Shop Merch</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Creators</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => handleSignup("artist")} className="hover:text-primary transition-colors text-left">Upload Music</button></li>
                <li><button onClick={() => handleSignup("artist")} className="hover:text-primary transition-colors text-left">Creator Dashboard</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help" className="hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link href="/help" className="hover:text-primary transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Rise Up Creators. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authMode}
      />
    </div>
  );
}
