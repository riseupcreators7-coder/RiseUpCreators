import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { Instagram, RefreshCw, ExternalLink, Heart, MessageCircle, Play, TrendingUp, CheckCircle, Share2, Facebook } from "lucide-react";
import { getCreatorAuthHeaders } from "./utils";
import { useState } from "react";
import Loading from "@/components/common/loading";
import { toast } from "@/hooks/use-toast";

interface InstagramAccount {
  accountId: string;
  username: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  profilePicture: string;
  biography: string;
  website: string;
  accountType: "BUSINESS" | "CREATOR" | "PERSONAL";
  verificationStatus: "pending" | "verified" | "rejected";
  lastSyncedAt: string;
}

interface InstagramMedia {
  mediaId: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  impressions: number;
  reach: number;
  engagement: number;
}

export default function InstagramTab() {
  const auth = useRequireRole("artist");
  const [showAllMedia, setShowAllMedia] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Meta connection status first
  const { data: metaStatus } = useQuery({
    queryKey: ["/api/creators/meta/status"],
    queryFn: async () => {
      const response = await fetch("/api/creators/meta/status", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch Meta status");
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Fetch Instagram account data
  const { data: instagramData, isLoading: instagramLoading, refetch: refetchAccount } = useQuery<{ 
    success: boolean; 
    hasAccount: boolean; 
    data?: InstagramAccount 
  }>({
    queryKey: ["/api/creators/instagram"],
    queryFn: async () => {
      const response = await fetch("/api/creators/instagram", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, hasAccount: false };
        }
        throw new Error("Failed to fetch Instagram data");
      }
      return response.json();
    },
    enabled: !!auth.user,
    retry: false, // Don't retry 404s
  });

  // Fetch Instagram media
  const { data: mediaData, isLoading: mediaLoading, refetch: refetchMedia } = useQuery<{
    success: boolean;
    data: InstagramMedia[];
  }>({
    queryKey: ["/api/creators/instagram/media", showAllMedia ? 50 : 12],
    queryFn: async () => {
      const response = await fetch(`/api/creators/instagram/media?limit=${showAllMedia ? 50 : 12}`, {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Instagram media");
      }
      return response.json();
    },
    enabled: !!auth.user && instagramData?.hasAccount === true,
    staleTime: 0,
  });

  // Refresh Instagram data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/creators/instagram/refresh", {
        method: "POST",
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to refresh Instagram data");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.removeQueries({ queryKey: ["/api/creators/instagram"] });
      queryClient.removeQueries({ queryKey: ["/api/creators/instagram/media"] });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetchAccount();
      await refetchMedia();
      
      toast({
        title: "Success!",
        description: `Instagram data synced! ${data.data?.followersCount || 0} followers`,
        duration: 5000
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (instagramLoading) {
    return (
      <TabsContent value="instagram">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading Instagram data..." />
        </div>
      </TabsContent>
    );
  }

  if (!instagramData?.hasAccount || !instagramData.data) {
    return (
      <TabsContent value="instagram">
        {metaStatus?.profile?.connected ? (
          <div className="space-y-6">
            {/* Profile Connected Header */}
            <Card className="border-pink-200 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50/30">
              <CardContent className="pt-8 pb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    {metaStatus.profile.profilePicture && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
                        <img 
                          src={metaStatus.profile.profilePicture} 
                          alt={metaStatus.profile.name}
                          className="relative w-28 h-28 rounded-full border-4 border-white shadow-2xl"
                        />
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-2 shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{metaStatus.profile.name}</h2>
                  {metaStatus.profile.email && (
                    <p className="text-muted-foreground mb-3">{metaStatus.profile.email}</p>
                  )}
                  
                  <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1.5">
                    <Facebook className="w-3.5 h-3.5 mr-1.5" />
                    Profile Connected
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* No Instagram Account Warning */}
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <CardContent className="pt-8 pb-8 relative">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-3 transition-transform">
                      <Instagram className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-purple-900 mb-2">No Instagram Business Account Found</h3>
                      <p className="text-purple-800 leading-relaxed">
                        Instagram Business accounts connect through Facebook Pages. Link your Instagram to unlock content display and analytics features.
                      </p>
                    </div>

                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-purple-200/50 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">1</span>
                        </div>
                        <div>
                          <p className="font-semibold text-purple-900 mb-1">Convert to Business Account</p>
                          <p className="text-sm text-purple-700">
                            Switch your Instagram to a Business or Creator account in settings
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">2</span>
                        </div>
                        <div>
                          <p className="font-semibold text-purple-900 mb-1">Link to Facebook Page</p>
                          <p className="text-sm text-purple-700">
                            Connect your Instagram account to your Facebook Page
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">3</span>
                        </div>
                        <div>
                          <p className="font-semibold text-purple-900 mb-1">Reconnect Your Account</p>
                          <p className="text-sm text-purple-700">
                            Return here and reconnect to grant Instagram permissions
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button 
                        onClick={() => window.open('https://help.instagram.com/502981923235522', '_blank')}
                        className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                      >
                        <Instagram className="w-4 h-4 mr-2" />
                        Instagram Setup Guide
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/creator?tab=settings'}
                        variant="outline"
                        size="lg"
                        className="border-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reconnect Account
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-pink-100 hover:border-pink-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Display Posts</h4>
                  <p className="text-sm text-muted-foreground">
                    Showcase your Instagram photos, videos, and stories
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-100 hover:border-purple-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Track Engagement</h4>
                  <p className="text-sm text-muted-foreground">
                    Monitor likes, comments, and follower growth
                  </p>
                </CardContent>
              </Card>

              <Card className="border-orange-100 hover:border-orange-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Expand Reach</h4>
                  <p className="text-sm text-muted-foreground">
                    Cross-promote content to grow your audience
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="border-pink-100">
            <CardContent className="py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
                    <Instagram className="w-12 h-12 text-white" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold mb-3">Connect Your Instagram Business Account</h3>
                <p className="text-muted-foreground text-lg mb-8">
                  Showcase your Instagram content, engage with fans, and display your account statistics
                </p>
                
                <Button 
                  onClick={() => window.location.href = '/creator?tab=settings'}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <Instagram className="w-5 h-5 mr-2" />
                  Connect Instagram Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    );
  }

  const account = instagramData.data;

  // Check verification status
  if (account.verificationStatus === "pending") {
    return (
      <TabsContent value="instagram">
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin" />
              </div>
              <Badge variant="secondary" className="mb-4">
                <RefreshCw className="w-3 h-3 mr-1" />
                Pending Review
              </Badge>
              <h3 className="text-lg font-semibold mb-2">Verification Pending</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Your Instagram account verification is under review by our admin team. 
                You'll receive an email notification once it's reviewed (typically within 24-48 hours).
              </p>
              <div className="p-4 bg-white rounded-lg text-left max-w-md mx-auto mb-4">
                <p className="text-sm font-medium mb-2">Account Details:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Username:</strong> @{account.username}</p>
                  <p><strong>Followers:</strong> {account.followersCount.toLocaleString()}</p>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/creator?tab=settings'}
              >
                View Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  if (account.verificationStatus === "rejected") {
    return (
      <TabsContent value="instagram">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-red-600" />
              </div>
              <Badge variant="destructive" className="mb-4">
                <ExternalLink className="w-3 h-3 mr-1" />
                Rejected
              </Badge>
              <h3 className="text-lg font-semibold mb-2">Verification Rejected</h3>
              <p className="text-muted-foreground mb-4">
                Your Instagram account verification was not approved.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                You can submit a different Instagram account for verification
              </p>
              <Button 
                onClick={() => window.location.href = '/creator?tab=settings'}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Submit Different Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const media = mediaData?.data || [];
  const displayMedia = showAllMedia ? media : media.slice(0, 9);

  // Calculate engagement rate
  const avgEngagementRate = media.length > 0
    ? media.reduce((sum, m) => sum + ((m.likes + m.comments) / account.followersCount * 100), 0) / media.length
    : 0;

  return (
    <TabsContent value="instagram" className="space-y-6">
      {/* Account Header */}
      <Card className="border-pink-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {account.profilePicture && (
              <img 
                src={account.profilePicture} 
                alt={account.username}
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">@{account.username}</h2>
                <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600">
                  <Instagram className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
                <Badge variant="default" className="bg-gray-800">
                  {account.accountType}
                </Badge>
              </div>
              {account.biography && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {account.biography}
                </p>
              )}
              {account.website && (
                <a 
                  href={account.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mb-4 block"
                >
                  {account.website}
                </a>
              )}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshMutation.isPending ? 'Syncing...' : 'Refresh Data'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://instagram.com/${account.username}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Profile
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Followers</p>
                <p className="text-2xl font-bold text-pink-600">
                  {formatNumber(account.followersCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <Instagram className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Following</p>
                <p className="text-2xl font-bold">
                  {formatNumber(account.followingCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Posts</p>
                <p className="text-2xl font-bold">
                  {formatNumber(account.mediaCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Play className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
                <p className="text-2xl font-bold">
                  {avgEngagementRate.toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Post */}
      {media.length > 0 && (() => {
        const topPost = media.reduce((max, m) => m.likes > max.likes ? m : max, media[0]);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-600" />
                Top Performing Post
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="relative flex-shrink-0">
                  <img 
                    src={topPost.thumbnailUrl || topPost.mediaUrl} 
                    alt={topPost.caption}
                    className="w-48 h-48 object-cover rounded-lg"
                  />
                  {topPost.mediaType === 'VIDEO' && (
                    <div className="absolute top-2 right-2 bg-black/80 text-white p-1 rounded">
                      <Play className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {topPost.caption || 'No caption'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {formatNumber(topPost.likes)} likes
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {formatNumber(topPost.comments)}
                    </span>
                    <span>{formatDate(topPost.timestamp)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => window.open(topPost.permalink, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Instagram
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Media Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Posts</CardTitle>
            {media.length > 9 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllMedia(!showAllMedia)}
              >
                {showAllMedia ? 'Show Less' : `View All (${media.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mediaLoading ? (
            <div className="flex justify-center py-8">
              <Loading size="md" text="Loading posts..." />
            </div>
          ) : displayMedia.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayMedia.map((item) => (
                <div 
                  key={item.mediaId}
                  className="group cursor-pointer"
                  onClick={() => window.open(item.permalink, '_blank')}
                >
                  <div className="relative aspect-square mb-2">
                    <img 
                      src={item.thumbnailUrl || item.mediaUrl} 
                      alt={item.caption}
                      className="w-full h-full object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                    />
                    {item.mediaType === 'VIDEO' && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded">
                        <Play className="w-4 h-4" />
                      </div>
                    )}
                    {item.mediaType === 'CAROUSEL_ALBUM' && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded text-xs">
                        📸
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white rounded-lg">
                      <span className="flex items-center gap-1">
                        <Heart className="w-5 h-5" />
                        {formatNumber(item.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-5 h-5" />
                        {formatNumber(item.comments)}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-medium line-clamp-2 mb-1 group-hover:text-pink-600 transition-colors text-sm">
                    {item.caption || 'No caption'}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(item.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {formatNumber(item.comments)}
                    </span>
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Synced Info */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              <span>Last synced: {new Date(account.lastSyncedAt).toLocaleString()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Syncing from Instagram...' : 'Sync Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
