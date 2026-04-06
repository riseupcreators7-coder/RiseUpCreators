import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Play, Heart, Share2, UserPlus, Calendar, ShoppingBag, FileText, Users, Music, MapPin, Clock, Star, Crown, Instagram, Youtube, Twitter, Globe, Lock, AlertCircle, CheckCircle, Facebook, ThumbsUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import BannerAd from "@/components/ads/banner-ad";
import ArtistSubscriptionModal from "@/components/subscription/artist-subscription-modal";

export default function ArtistProfile() {
  const [, params] = useRoute("/artist/:id");
  const artistId = params?.id;
  const [activeTab, setActiveTab] = useState("music");
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const { user } = useAuth();
  const { play, addToQueue } = useMusicPlayer();
  const queryClient = useQueryClient();
  const setLocation = useLocation()[1];
  const isMobile = useIsMobile();

  // Fetch YouTube videos for artist
  const { data: youtubeVideos, isLoading: videosLoading } = useQuery({
    queryKey: [`/api/artists/${artistId}/youtube/videos`],
    queryFn: async () => {
      if (!artistId) return null;
      
      const response = await fetch(`/api/artists/${artistId}/youtube/videos?limit=6`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!artistId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Fetch Facebook Page data for artist
  const { data: facebookData } = useQuery({
    queryKey: [`/api/artists/${artistId}/facebook`],
    queryFn: async () => {
      if (!artistId) return null;
      
      const response = await fetch(`/api/artists/${artistId}/facebook`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!artistId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch Instagram account data for artist
  const { data: instagramData } = useQuery({
    queryKey: [`/api/artists/${artistId}/instagram`],
    queryFn: async () => {
      if (!artistId) return null;
      
      const response = await fetch(`/api/artists/${artistId}/instagram`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!artistId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch artist profile data - MOVED TO TOP TO AVOID HOOK ORDER ISSUES
  const { data: artist, isLoading: artistLoading, error: artistError } = useQuery({
    queryKey: [`/api/artists/${artistId}`],
    queryFn: async () => {
      if (!artistId) throw new Error("No artist ID provided");
      
      const response = await fetch(`/api/artists/${artistId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch artist: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!artistId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      // Only retry on 500 errors, not 404s
      return failureCount < 3 && error?.response?.status >= 500;
    }
  });

  // Check subscription status - MOVED TO TOP TO AVOID HOOK ORDER ISSUES
  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/users/me/subscription-status", artistId],
    queryFn: async () => {
      if (!artistId || !user) return { isSubscribed: false, subscription: null };
      
      const response = await fetch(`/api/users/me/subscription-status/${artistId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) return { isSubscribed: false, subscription: null };
      return response.json();
    },
    enabled: !!artistId && !!user,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
  });

  // Follow mutation - MOVED TO TOP TO AVOID HOOK ORDER ISSUES
  const followMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/follow/${artistId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to follow artist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${artistId}`] });
      toast({
        title: "Success",
        description: "Artist followed successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to follow artist",
        variant: "destructive"
      });
    }
  });

  // Track profile view when artist data loads
  useEffect(() => {
    if (user && artist && artistId) {
      fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          artistId: artistId,
          action: "view",
          context: "profile",
          metadata: {
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            referrer: document.referrer
          }
        })
      }).catch(console.error);
    }
  }, [user, artist, artistId]);

  // Track profile view when artist data loads
  useEffect(() => {
    if (user && artist && artistId) {
      fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          artistId: artistId,
          action: "view",
          context: "profile",
          metadata: {
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            referrer: document.referrer
          }
        })
      }).catch(console.error);
    }
  }, [user, artist, artistId]);

  // Early return if no artist ID
  if (!artistId) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Artist URL</h2>
            <p className="text-muted-foreground mb-4">
              No artist ID was provided in the URL.
            </p>
            <Button onClick={() => setLocation('/discover')}>
              Browse Artists
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (artistLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading artist profile..." />
      </div>
    );
  }

  if (artistError || !artist) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Artist Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {artistError?.message?.includes('404') 
                ? `The artist with ID "${artistId}" doesn't exist or has been removed.`
                : `Failed to load artist profile. Please try again later.`
              }
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-muted-foreground mt-4 p-2 bg-muted rounded">
                <p>Debug Info:</p>
                <p>Artist ID: {artistId}</p>
                <p>Error: {artistError?.message || 'No artist data'}</p>
              </div>
            )}
            <Button 
              className="mt-4" 
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFollowing = user?.following?.includes(artistId || '');
  const isSubscribed = subscriptionStatus?.isSubscribed || false;
  const currentSubscription = subscriptionStatus?.subscription || null;

  const handlePlaySong = (song: any) => {
    // ✅ FIX: Check if song is playable before attempting to play
    if (song.visibility === "SUBSCRIBER_ONLY" && !isSubscribed && user?._id !== artistId) {
      toast({
        title: "Premium Content",
        description: "Subscribe to this artist to play their premium songs",
        variant: "destructive"
      });
      setShowSubscriptionModal(true);
      return;
    }

    // Check if song is locked (for display purposes)
    if (song.isLocked) {
      toast({
        title: "Premium Content",
        description: "Subscribe to this artist to play their premium songs",
        variant: "destructive"
      });
      setShowSubscriptionModal(true);
      return;
    }

    if ((artist as any).songs) {
      addToQueue((artist as any).songs);
    }
    play(song);

    // Track song play from artist profile
    if (user) {
      fetch(`/api/songs/${song._id}/play`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      }).catch(console.error);

      // Track analytics
      fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          songId: song._id,
          artistId: artistId,
          action: "play",
          context: "profile",
          metadata: {
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
          }
        })
      }).catch(console.error);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    const artistData = artist as any;
    if (navigator.share) {
      navigator.share({
        title: `${artistData.name} - Rise Up Creators`,
        text: `Check out ${artistData.name} on Rise Up Creators`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Profile link copied to clipboard"
      });
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-24">
      {/* Hero Section */}
      <div className={`relative ${isMobile ? 'h-64' : 'h-80'} overflow-hidden`}>
        <img
          src={(artist as any).avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${(artist as any).email || (artist as any).name}`}
          alt="Artist cover"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${(artist as any).email || (artist as any).name}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>

        <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-4' : 'p-8'}`}>
          <div className={`container-custom ${isMobile ? 'flex flex-col space-y-4' : 'flex items-end space-x-6'}`}>
            <Avatar className={`${isMobile ? 'w-20 h-20 mx-auto' : 'w-32 h-32'} border-4 border-white`}>
              <AvatarImage src={(artist as any).avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${(artist as any).email || (artist as any).name}`} />
              <AvatarFallback className={`${isMobile ? 'text-lg' : 'text-2xl'}`}>{(artist as any).name?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>

            <div className={`flex-1 ${isMobile ? 'text-center' : ''}`}>
              <div className={`${isMobile ? 'flex flex-col items-center space-y-2 mb-3' : 'flex items-center space-x-2 mb-2'}`}>
                <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold text-white`}>{(artist as any).name || 'Artist'}</h1>
                <div className={`${isMobile ? 'flex space-x-2' : 'contents'}`}>
                  {(artist as any).artist?.verified && (
                    <Badge className="bg-success text-white">
                      <Crown className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {(artist as any).artist?.featured && (
                    <Badge className="bg-primary text-white">
                      Featured
                    </Badge>
                  )}
                </div>
              </div>
              <p className={`text-white/80 mb-4 ${isMobile ? 'text-sm' : ''}`}>{(artist as any).artist?.bio || 'Music Artist'}</p>

              {/* Social Links */}
              {(artist as any).artist?.socialLinks && (
                <div className={`${isMobile ? 'flex flex-wrap justify-center gap-2 mb-3' : 'flex items-center space-x-4 mb-4'}`}>
                  {(artist as any).artist.socialLinks.website && (
                    <a
                      href={(artist as any).artist.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-white/60 hover:text-white transition-colors flex items-center gap-1 ${isMobile ? 'text-xs' : ''}`}
                    >
                      <Globe className="w-4 h-4" />
                      {!isMobile && 'Website'}
                    </a>
                  )}
                  {(artist as any).artist.socialLinks.instagram && (
                    <a
                      href={`https://instagram.com/${(artist as any).artist.socialLinks.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-white/60 hover:text-pink-400 transition-colors flex items-center gap-1 ${isMobile ? 'text-xs' : ''}`}
                    >
                      <Instagram className="w-4 h-4" />
                      {!isMobile && 'Instagram'}
                    </a>
                  )}
                  {(artist as any).artist.socialLinks.youtube && (
                    <a
                      href={(artist as any).artist.socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-white/60 hover:text-red-500 transition-colors flex items-center gap-1 ${isMobile ? 'text-xs' : ''}`}
                    >
                      <Youtube className="w-4 h-4" />
                      {!isMobile && 'YouTube'}
                    </a>
                  )}
                  {(artist as any).artist.socialLinks.x && (
                    <a
                      href={`https://twitter.com/${(artist as any).artist.socialLinks.x.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-white/60 hover:text-blue-400 transition-colors flex items-center gap-1 ${isMobile ? 'text-xs' : ''}`}
                    >
                      <Twitter className="w-4 h-4" />
                      {!isMobile && 'X/Twitter'}
                    </a>
                  )}
                </div>
              )}

              <div className={`${isMobile ? 'flex flex-wrap justify-center gap-4 text-white/60 text-xs mb-3' : 'flex items-center space-x-6 text-white/60 text-sm mb-4'}`}>
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {artist?.artist?.followers?.length || 0} followers
                </span>
                <span className="flex items-center">
                  <Music className="w-4 h-4 mr-1" />
                  {artist?.songs?.length || 0} songs
                </span>
                <span className="flex items-center">
                  <Star className="w-4 h-4 mr-1" />
                  {artist?.artist?.totalLikes || 0} likes
                </span>
              </div>

              <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex items-center space-x-3'}`}>
                {isMobile ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      size="default"
                      className="gradient-primary hover:opacity-90"
                      onClick={() => (artist as any).songs?.[0] && handlePlaySong((artist as any).songs[0])}
                      disabled={!(artist as any).songs?.length}
                      data-testid="play-artist-songs"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Play
                    </Button>

                    {user && (
                      <Button 
                        size="default"
                        variant="outline"
                        onClick={() => followMutation.mutate()}
                        disabled={followMutation.isPending}
                        className="border-white text-white hover:bg-white hover:text-black"
                        data-testid="follow-artist-button"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {isFollowing ? 'Following' : 'Follow'}
                      </Button>
                    )}

                    {user && user._id !== artistId && (
                      <Button 
                        size="default"
                        variant={isSubscribed ? "default" : "outline"}
                        onClick={() => !isSubscribed && setShowSubscriptionModal(true)}
                        disabled={isSubscribed || subscriptionLoading}
                        className={isSubscribed 
                          ? "bg-green-600 text-white cursor-not-allowed opacity-80" 
                          : "border-white text-white hover:bg-white hover:text-black"
                        }
                        data-testid="subscribe-artist-button"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        {subscriptionLoading ? 'Checking...' : (isSubscribed ? 'Subscribed ✓' : 'Subscribe')}
                      </Button>
                    )}

                    <Button 
                      size="default"
                      variant="outline"
                      onClick={handleShare}
                      className="border-white text-white hover:bg-white hover:text-black"
                      data-testid="share-artist-button"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="gradient-primary hover:opacity-90"
                      onClick={() => (artist as any).songs?.[0] && handlePlaySong((artist as any).songs[0])}
                      disabled={!(artist as any).songs?.length}
                      data-testid="play-artist-songs"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Play
                    </Button>

                    {user && (
                      <Button 
                        size="lg"
                        variant="outline"
                        onClick={() => followMutation.mutate()}
                        disabled={followMutation.isPending}
                        className="border-white text-white hover:bg-white hover:text-black"
                        data-testid="follow-artist-button"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {isFollowing ? 'Following' : 'Follow'}
                      </Button>
                    )}

                    {user && user._id !== artistId && (
                      <Button 
                        size="lg"
                        variant={isSubscribed ? "default" : "outline"}
                        onClick={() => !isSubscribed && setShowSubscriptionModal(true)}
                        disabled={isSubscribed || subscriptionLoading}
                        className={isSubscribed 
                          ? "bg-green-600 text-white cursor-not-allowed opacity-80" 
                          : "border-white text-white hover:bg-white hover:text-black"
                        }
                        data-testid="subscribe-artist-button"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        {subscriptionLoading ? 'Checking...' : (isSubscribed ? 'Subscribed ✓' : 'Subscribe')}
                      </Button>
                    )}

                    <Button 
                      size="lg"
                      variant="outline"
                      onClick={handleShare}
                      className="border-white text-white hover:bg-white hover:text-black"
                      data-testid="share-artist-button"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Ad - Only show for FREE users */}
      {(!user?.plan || user.plan.type === "FREE") && (
        <div className="flex justify-center py-8">
          <BannerAd
            placement="ARTIST_PROFILE"
            size="728x90"
          />
        </div>
      )}

      {/* Content Tabs */}
      <div className={`container-custom ${isMobile ? 'py-4 px-4' : 'py-8'}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full grid-cols-5 ${isMobile ? 'mb-6' : 'mb-8'}`}>
            <TabsTrigger value="music" data-testid="music-tab" className={isMobile ? 'text-xs px-2' : ''}>
              <Music className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 ${isMobile ? 'md:mr-2' : 'mr-2'}`} />
              {isMobile ? 'Music' : 'Music'}
            </TabsTrigger>
            <TabsTrigger value="socials" data-testid="socials-tab" className={isMobile ? 'text-xs px-2' : ''}>
              <Youtube className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 ${isMobile ? 'md:mr-2' : 'mr-2'}`} />
              {isMobile ? 'Social' : 'Socials'}
            </TabsTrigger>
            <TabsTrigger value="blogs" data-testid="blogs-tab" className={isMobile ? 'text-xs px-2' : ''}>
              <FileText className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 ${isMobile ? 'md:mr-2' : 'mr-2'}`} />
              {isMobile ? 'Blogs' : 'Blogs'}
            </TabsTrigger>
            <TabsTrigger value="merch" data-testid="merch-tab" className={isMobile ? 'text-xs px-2' : ''}>
              <ShoppingBag className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 ${isMobile ? 'md:mr-2' : 'mr-2'}`} />
              {isMobile ? 'Merch' : 'Merch'}
            </TabsTrigger>
            <TabsTrigger value="events" data-testid="events-tab" className={isMobile ? 'text-xs px-2' : ''}>
              <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 ${isMobile ? 'md:mr-2' : 'mr-2'}`} />
              {isMobile ? 'Events' : 'Events'}
            </TabsTrigger>
          </TabsList>

          {/* Music Tab */}
          <TabsContent value="music">
            {(artist as any).songs && (artist as any).songs.length > 0 ? (
              <div className="space-y-4">
                {(artist as any).songs.map((song: any, index: number) => (
                  <div 
                    key={song._id}
                    className={`music-card group cursor-pointer flex items-center ${isMobile ? 'space-x-3 p-3' : 'space-x-4 p-4'} ${
                      song.visibility === 'SUBSCRIBER_ONLY' && !isSubscribed && user?._id !== artistId ? 'opacity-60' : ''
                    }`}
                    onClick={() => handlePlaySong(song)}
                    data-testid={`artist-song-${index}`}
                  >
                    <div className="relative">
                      <img
                        src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"}
                        alt={song.title}
                        className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-lg object-cover shadow-md cursor-pointer hover:opacity-80 transition-opacity`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100";
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/song/${song._id}`);
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {song.visibility === 'SUBSCRIBER_ONLY' && !isSubscribed && user?._id !== artistId ? (
                          <Lock className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
                        ) : (
                          <Play className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold group-hover:text-primary transition-colors ${isMobile ? 'text-sm truncate' : ''}`}>
                        {song.title}
                        {song.visibility === 'SUBSCRIBER_ONLY' && !isSubscribed && user?._id !== artistId && (
                          <Lock className="w-3 h-3 inline ml-2 text-muted-foreground" />
                        )}
                      </h4>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground truncate`}>{song.genre}</p>
                      <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-4'} mt-1`}>
                        <span className="text-xs text-muted-foreground">
                          {song.plays?.toLocaleString() || 0} plays
                        </span>
                        {song.visibility === 'SUBSCRIBER_ONLY' && (
                          <Badge 
                            variant={isSubscribed || user?._id === artistId ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {isSubscribed || user?._id === artistId ? "Premium Content" : "Subscribers Only"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                        {Math.floor((song.durationSec || 0) / 60)}:{((song.durationSec || 0) % 60).toString().padStart(2, '0')}
                      </span>
                      <Button variant="ghost" size={isMobile ? "sm" : "icon"}>
                        <Heart className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No songs available</h3>
                  <p className="text-muted-foreground">This artist hasn't uploaded any songs yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Socials Tab */}
          <TabsContent value="socials">
            <div className="space-y-6">
              {/* YouTube Channel Section */}
              {(artist as any)?.artist?.youtubeChannel && (artist as any).artist.youtubeChannel.verificationStatus === "verified" ? (
                <div className="space-y-6">
                  <Card className="overflow-hidden border-red-200 dark:border-red-900">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-full">
                        <Youtube className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">YouTube Channel</h3>
                        <p className="text-white/90 text-sm">Verified Creator</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      {(artist as any).artist.youtubeChannel.thumbnails?.medium && (
                        <img 
                          src={(artist as any).artist.youtubeChannel.thumbnails.medium} 
                          alt={(artist as any).artist.youtubeChannel.channelName}
                          className="w-20 h-20 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg">{(artist as any).artist.youtubeChannel.channelName}</h4>
                          {(artist as any).artist.youtubeChannel.isYouTubeVerified && (
                            <Badge variant="default" className="bg-gray-800 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              YouTube Verified
                            </Badge>
                          )}
                        </div>
                        {(artist as any).artist.youtubeChannel.customUrl && (
                          <p className="text-sm text-muted-foreground">@{(artist as any).artist.youtubeChannel.customUrl}</p>
                        )}
                        {(artist as any).artist.youtubeChannel.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {(artist as any).artist.youtubeChannel.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                          <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Subscribers</p>
                          <p className="text-2xl font-bold">
                            {((artist as any).artist.youtubeChannel.subscriberCount >= 1000000
                              ? ((artist as any).artist.youtubeChannel.subscriberCount / 1000000).toFixed(1) + 'M'
                              : (artist as any).artist.youtubeChannel.subscriberCount >= 1000
                              ? ((artist as any).artist.youtubeChannel.subscriberCount / 1000).toFixed(1) + 'K'
                              : (artist as any).artist.youtubeChannel.subscriberCount.toLocaleString())}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                          <Play className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Videos</p>
                          <p className="text-2xl font-bold">
                            {(artist as any).artist.youtubeChannel.videoCount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                        <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                          <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Views</p>
                          <p className="text-2xl font-bold">
                            {((artist as any).artist.youtubeChannel.viewCount >= 1000000
                              ? ((artist as any).artist.youtubeChannel.viewCount / 1000000).toFixed(1) + 'M'
                              : (artist as any).artist.youtubeChannel.viewCount >= 1000
                              ? ((artist as any).artist.youtubeChannel.viewCount / 1000).toFixed(1) + 'K'
                              : (artist as any).artist.youtubeChannel.viewCount.toLocaleString())}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                      >
                        <a
                          href={(artist as any).artist.youtubeChannel.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <Youtube className="w-4 h-4" />
                          Visit Channel
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Videos Section */}
                {youtubeVideos?.success && youtubeVideos.data && youtubeVideos.data.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-red-600" />
                        Recent Videos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {youtubeVideos.data.map((video: any) => (
                          <a
                            key={video.videoId}
                            href={`https://www.youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block"
                          >
                            <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                              <img
                                src={video.thumbnails?.high || video.thumbnails?.medium || video.thumbnails?.default}
                                alt={video.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-red-600 rounded-full p-3">
                                  <Play className="w-6 h-6 text-white fill-white" />
                                </div>
                              </div>
                              {video.duration && (
                                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                  {video.duration}
                                </div>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-red-600 transition-colors mb-1">
                              {video.title}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {video.viewCount && (
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  {parseInt(video.viewCount).toLocaleString()} views
                                </span>
                              )}
                              {video.publishedAt && (
                                <span>
                                  {new Date(video.publishedAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                      <div className="mt-6 text-center">
                        <Button
                          variant="outline"
                          asChild
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                        >
                          <a
                            href={(artist as any).artist.youtubeChannel.channelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <Youtube className="w-4 h-4" />
                            View All Videos on YouTube
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {videosLoading && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading videos...</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (artist as any)?.artist?.youtubeChannel?.verificationStatus === "pending" ? (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                    <Badge variant="secondary" className="mb-4">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending Verification
                    </Badge>
                    <h3 className="text-lg font-semibold mb-2">YouTube Channel Under Review</h3>
                    <p className="text-muted-foreground">
                      This artist's YouTube channel is currently being verified by our team.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (artist as any)?.artist?.youtubeChannel?.verificationStatus === "rejected" ? (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <Badge variant="destructive" className="mb-4">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Verification Rejected
                    </Badge>
                    <h3 className="text-lg font-semibold mb-2">YouTube Channel Not Verified</h3>
                    <p className="text-muted-foreground">
                      This artist's YouTube channel verification was not approved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Youtube className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No YouTube Channel Connected</h3>
                  <p className="text-muted-foreground">This artist hasn't connected their YouTube channel yet.</p>
                </CardContent>
              </Card>
            )}

            {/* Facebook Page Section */}
            {facebookData?.success && facebookData.hasPage && facebookData.data ? (
              <Card className="overflow-hidden border-blue-200 dark:border-blue-900">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Facebook className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Facebook Page</h3>
                      <p className="text-white/90 text-sm">Verified Page</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    {facebookData.data.profilePicture && (
                      <img 
                        src={facebookData.data.profilePicture} 
                        alt={facebookData.data.pageName}
                        className="w-20 h-20 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-lg">{facebookData.data.pageName}</h4>
                        {facebookData.data.isVerified && (
                          <Badge variant="default" className="bg-blue-600 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Facebook Verified
                          </Badge>
                        )}
                      </div>
                      {facebookData.data.username && (
                        <p className="text-sm text-muted-foreground">@{facebookData.data.username}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{facebookData.data.category}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Followers</p>
                        <p className="text-2xl font-bold">
                          {(facebookData.data.followersCount >= 1000000
                            ? (facebookData.data.followersCount / 1000000).toFixed(1) + 'M'
                            : facebookData.data.followersCount >= 1000
                            ? (facebookData.data.followersCount / 1000).toFixed(1) + 'K'
                            : facebookData.data.followersCount.toLocaleString())}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                        <ThumbsUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Page Likes</p>
                        <p className="text-2xl font-bold">
                          {(facebookData.data.likesCount >= 1000000
                            ? (facebookData.data.likesCount / 1000000).toFixed(1) + 'M'
                            : facebookData.data.likesCount >= 1000
                            ? (facebookData.data.likesCount / 1000).toFixed(1) + 'K'
                            : facebookData.data.likesCount.toLocaleString())}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30"
                    >
                      <a
                        href={`https://facebook.com/${facebookData.data.username || facebookData.data.pageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <Facebook className="w-4 h-4" />
                        Visit Page
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (artist as any)?.artist?.metaConnections?.facebookProfile?.connected ? (
              <Card className="border-blue-100">
                <CardContent className="py-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Facebook className="w-8 h-8 text-blue-600" />
                    </div>
                    <Badge variant="default" className="bg-blue-600 mb-3">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Profile Connected
                    </Badge>
                    <h3 className="text-lg font-semibold mb-2">Facebook Profile Connected</h3>
                    <p className="text-muted-foreground text-sm">
                      This artist has connected their Facebook profile but hasn't linked a Facebook Page yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Instagram Account Section */}
            {instagramData?.success && instagramData.hasAccount && instagramData.data ? (
              <Card className="overflow-hidden border-pink-200 dark:border-pink-900">
                <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Instagram className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Instagram</h3>
                      <p className="text-white/90 text-sm">Business Account</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    {instagramData.data.profilePicture && (
                      <img 
                        src={instagramData.data.profilePicture} 
                        alt={instagramData.data.username}
                        className="w-20 h-20 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-lg">@{instagramData.data.username}</h4>
                        <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600 text-xs">
                          {instagramData.data.accountType}
                        </Badge>
                      </div>
                      {instagramData.data.biography && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {instagramData.data.biography}
                        </p>
                      )}
                      {instagramData.data.website && (
                        <a 
                          href={instagramData.data.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-1 block"
                        >
                          {instagramData.data.website}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center gap-4 p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg">
                      <div className="bg-pink-100 dark:bg-pink-900 p-3 rounded-full">
                        <Users className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Followers</p>
                        <p className="text-2xl font-bold">
                          {(instagramData.data.followersCount >= 1000000
                            ? (instagramData.data.followersCount / 1000000).toFixed(1) + 'M'
                            : instagramData.data.followersCount >= 1000
                            ? (instagramData.data.followersCount / 1000).toFixed(1) + 'K'
                            : instagramData.data.followersCount.toLocaleString())}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                        <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Following</p>
                        <p className="text-2xl font-bold">
                          {(instagramData.data.followingCount >= 1000000
                            ? (instagramData.data.followingCount / 1000000).toFixed(1) + 'M'
                            : instagramData.data.followingCount >= 1000
                            ? (instagramData.data.followingCount / 1000).toFixed(1) + 'K'
                            : instagramData.data.followingCount.toLocaleString())}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                      <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                        <Play className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Posts</p>
                        <p className="text-2xl font-bold">
                          {instagramData.data.mediaCount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-pink-600 border-pink-200 hover:bg-pink-50 dark:text-pink-400 dark:border-pink-800 dark:hover:bg-pink-950/30"
                    >
                      <a
                        href={`https://instagram.com/${instagramData.data.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <Instagram className="w-4 h-4" />
                        Visit Profile
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (artist as any)?.artist?.metaConnections?.facebookProfile?.connected ? (
              <Card className="border-purple-100">
                <CardContent className="py-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Instagram className="w-8 h-8 text-pink-600" />
                    </div>
                    <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600 mb-3">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Profile Connected
                    </Badge>
                    <h3 className="text-lg font-semibold mb-2">Instagram Not Linked</h3>
                    <p className="text-muted-foreground text-sm">
                      This artist has connected Facebook but hasn't linked an Instagram Business account yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Other Social Media Platforms - Placeholder for future */}
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Other Social Platforms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(artist as any).artist?.socialLinks?.instagram && (
                      <a
                        href={`https://instagram.com/${(artist as any).artist.socialLinks.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
                      >
                        <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-full">
                          <Instagram className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">Instagram</p>
                          <p className="text-sm text-muted-foreground">{(artist as any).artist.socialLinks.instagram}</p>
                        </div>
                      </a>
                    )}

                    {(artist as any).artist?.socialLinks?.x && (
                      <a
                        href={`https://twitter.com/${(artist as any).artist.socialLinks.x.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <div className="bg-blue-500 p-3 rounded-full">
                          <Twitter className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">X (Twitter)</p>
                          <p className="text-sm text-muted-foreground">{(artist as any).artist.socialLinks.x}</p>
                        </div>
                      </a>
                    )}

                    {(artist as any).artist?.socialLinks?.website && (
                      <a
                        href={(artist as any).artist.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-950/20 transition-colors"
                      >
                        <div className="bg-gray-500 p-3 rounded-full">
                          <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">Website</p>
                          <p className="text-sm text-muted-foreground truncate">{(artist as any).artist.socialLinks.website}</p>
                        </div>
                      </a>
                    )}

                    {!(artist as any).artist?.socialLinks?.instagram && 
                     !(artist as any).artist?.socialLinks?.x && 
                     !(artist as any).artist?.socialLinks?.website && (
                      <div className="col-span-2 text-center py-8 text-muted-foreground">
                        <p>No other social media links available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Blogs Tab */}
          <TabsContent value="blogs">
            {(artist as any).blogs && (artist as any).blogs.length > 0 ? (
              <div className="space-y-6">
                {(artist as any).blogs.map((blog: any, index: number) => (
                  <Card key={blog._id} data-testid={`artist-blog-${index}`}>
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLocation(`/blogs/${blog._id}`)}
                        >
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
                  <h3 className="text-lg font-semibold mb-2">No blogs available</h3>
                  <p className="text-muted-foreground">This artist hasn't published any blogs yet.</p>
                  {!isSubscribed && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Subscribe to access exclusive content when available.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Merch Tab */}
          <TabsContent value="merch">
            {(artist as any).merch && (artist as any).merch.length > 0 ? (
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {(artist as any).merch.map((item: any, index: number) => (
                  <div 
                    key={item._id}
                    className="merch-card group cursor-pointer"
                    data-testid={`artist-merch-${index}`}
                    onClick={() => setLocation(`/merch/${item._id}`)}
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden mb-4">
                      <img 
                        src={item.images?.[0] || "https://images.unsplash.com/photo-1521572163474-686449cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300"}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle heart/wishlist functionality
                        }}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                    <h4 className={`font-semibold mb-1 truncate ${isMobile ? 'text-sm' : ''}`}>{item.name}</h4>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground mb-2 line-clamp-2`}>{item.description}</p>
                    <div className="flex items-center justify-center">
                      <span className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-primary`}>₹{item.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No merchandise available</h3>
                  <p className="text-muted-foreground">This artist hasn't listed any merchandise yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            {(artist as any).events && (artist as any).events.length > 0 ? (
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {(artist as any).events.map((event: any, index: number) => (
                  <div 
                    key={event._id}
                    className="event-card group cursor-pointer"
                    data-testid={`artist-event-${index}`}
                    onClick={() => setLocation(`/event/${event._id}`)}
                  >
                    <div className={`relative ${isMobile ? 'h-32' : 'h-48'} rounded-t-2xl overflow-hidden`}>
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=100&h=100";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <Calendar className="w-12 h-12 text-muted-foreground opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <Badge className="absolute top-4 right-4 bg-primary text-white">
                        {new Date(event.date) > new Date() ? 'UPCOMING' : 'PAST'}
                      </Badge>
                    </div>

                    <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
                      <div className={`${isMobile ? 'flex flex-col space-y-3 mb-3' : 'flex items-start justify-between mb-4'}`}>
                        <div className="flex-1">
                          <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold mb-2 group-hover:text-primary transition-colors`}>
                            {event.title}
                          </h3>
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                            {event.description}
                          </p>
                        </div>
                        <div className={`${isMobile ? 'flex items-center justify-between' : 'text-right ml-4'}`}>
                          <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-primary`}>
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
                          <MapPin className="w-4 h-4 mr-2" />
                          {event.location}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-2" />
                          {new Date(event.date).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-lg font-bold text-primary">₹{event.ticketPrice}</span>
                          <span className="text-sm text-muted-foreground ml-1">onwards</span>
                          <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
                  <p className="text-muted-foreground">This artist hasn't scheduled any events yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Subscription Modal */}
      <ArtistSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        artistId={artistId || ''}
        artistName={(artist as any)?.name || 'Artist'}
        artistAvatar={(artist as any)?.avatarUrl}
        currentSubscription={currentSubscription}
        subscriptionSettings={(artist as any)?.subscriptionSettings}
      />
    </div>
  );
}
