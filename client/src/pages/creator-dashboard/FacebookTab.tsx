import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { Facebook, RefreshCw, ExternalLink, ThumbsUp, MessageSquare, Share2, TrendingUp, CheckCircle } from "lucide-react";
import { getCreatorAuthHeaders } from "./utils";
import { useState } from "react";
import Loading from "@/components/common/loading";
import { toast } from "@/hooks/use-toast";

interface FacebookPage {
  pageId: string;
  pageName: string;
  username: string;
  followersCount: number;
  likesCount: number;
  profilePicture: string;
  coverPhoto: string;
  isVerified: boolean;
  category: string;
  verificationStatus: "pending" | "verified" | "rejected";
  lastSyncedAt: string;
}

interface FacebookPost {
  postId: string;
  message: string;
  createdTime: string;
  image: string | null;
  type: string;
  permalink: string;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

export default function FacebookTab() {
  const auth = useRequireRole("artist");
  const [showAllPosts, setShowAllPosts] = useState(false);
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

  // Fetch Facebook page data
  const { data: facebookData, isLoading: facebookLoading, refetch: refetchPage } = useQuery<{ 
    success: boolean; 
    hasPage: boolean; 
    data?: FacebookPage 
  }>({
    queryKey: ["/api/creators/facebook"],
    queryFn: async () => {
      const response = await fetch("/api/creators/facebook", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, hasPage: false };
        }
        throw new Error("Failed to fetch Facebook data");
      }
      return response.json();
    },
    enabled: !!auth.user,
    retry: false, // Don't retry 404s
  });

  // Fetch Facebook posts
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useQuery<{
    success: boolean;
    data: FacebookPost[];
  }>({
    queryKey: ["/api/creators/facebook/posts", showAllPosts ? 50 : 12],
    queryFn: async () => {
      const response = await fetch(`/api/creators/facebook/posts?limit=${showAllPosts ? 50 : 12}`, {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Facebook posts");
      }
      return response.json();
    },
    enabled: !!auth.user && facebookData?.hasPage === true,
    staleTime: 0,
  });

  // Refresh Facebook data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/creators/facebook/refresh", {
        method: "POST",
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to refresh Facebook data");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.removeQueries({ queryKey: ["/api/creators/facebook"] });
      queryClient.removeQueries({ queryKey: ["/api/creators/facebook/posts"] });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetchPage();
      await refetchPosts();
      
      toast({
        title: "Success!",
        description: `Facebook data synced! ${data.data?.followersCount || 0} followers`,
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

  if (facebookLoading) {
    return (
      <TabsContent value="facebook">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading Facebook data..." />
        </div>
      </TabsContent>
    );
  }

  if (!facebookData?.hasPage || !facebookData.data) {
    return (
      <TabsContent value="facebook">
        {metaStatus?.profile?.connected ? (
          <div className="space-y-6">
            {/* Profile Connected Header */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/30">
              <CardContent className="pt-8 pb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    {metaStatus.profile.profilePicture && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
                        <img 
                          src={metaStatus.profile.profilePicture} 
                          alt={metaStatus.profile.name}
                          className="relative w-28 h-28 rounded-full border-4 border-white shadow-2xl"
                        />
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2 shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{metaStatus.profile.name}</h2>
                  {metaStatus.profile.email && (
                    <p className="text-muted-foreground mb-3">{metaStatus.profile.email}</p>
                  )}
                  
                  <Badge variant="default" className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-1.5">
                    <Facebook className="w-3.5 h-3.5 mr-1.5" />
                    Profile Connected
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* No Page Warning */}
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <CardContent className="pt-8 pb-8 relative">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-6 transition-transform">
                      <Facebook className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-amber-900 mb-2">No Facebook Page Found</h3>
                      <p className="text-amber-800 leading-relaxed">
                        To unlock Facebook content display, analytics, and audience engagement features, you need to manage a Facebook Page.
                      </p>
                    </div>

                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-amber-200/50 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">1</span>
                        </div>
                        <div>
                          <p className="font-semibold text-amber-900 mb-1">Create a Facebook Page</p>
                          <p className="text-sm text-amber-700">
                            Set up a new page for your brand, business, or creator profile
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">2</span>
                        </div>
                        <div>
                          <p className="font-semibold text-amber-900 mb-1">Reconnect Your Account</p>
                          <p className="text-sm text-amber-700">
                            After creating your page, reconnect to grant page access permissions
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button 
                        onClick={() => window.open('https://facebook.com/pages/create', '_blank')}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        Create Facebook Page
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/creator?tab=settings'}
                        variant="outline"
                        size="lg"
                        className="border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
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
              <Card className="border-blue-100 hover:border-blue-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <ThumbsUp className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Display Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Showcase your latest posts and updates to your audience
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-100 hover:border-purple-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Track Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    Monitor engagement, reach, and follower growth metrics
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-100 hover:border-green-200 transition-colors hover:shadow-md">
                <CardContent className="pt-6 pb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Grow Audience</h4>
                  <p className="text-sm text-muted-foreground">
                    Cross-promote and expand your reach across platforms
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="border-blue-100">
            <CardContent className="py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
                    <Facebook className="w-12 h-12 text-white" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold mb-3">Connect Your Facebook Page</h3>
                <p className="text-muted-foreground text-lg mb-8">
                  Showcase your Facebook content, engage with fans, and display your page statistics
                </p>
                
                <Button 
                  onClick={() => window.location.href = '/creator?tab=settings'}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <Facebook className="w-5 h-5 mr-2" />
                  Connect Facebook Page
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    );
  }

  const page = facebookData.data;

  // Check verification status
  if (page.verificationStatus === "pending") {
    return (
      <TabsContent value="facebook">
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
                Your Facebook Page verification is under review by our admin team. 
                You'll receive an email notification once it's reviewed (typically within 24-48 hours).
              </p>
              <div className="p-4 bg-white rounded-lg text-left max-w-md mx-auto mb-4">
                <p className="text-sm font-medium mb-2">Page Details:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Page:</strong> {page.pageName}</p>
                  <p><strong>Followers:</strong> {page.followersCount.toLocaleString()}</p>
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

  if (page.verificationStatus === "rejected") {
    return (
      <TabsContent value="facebook">
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
                Your Facebook Page verification was not approved.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                You can submit a different Facebook Page for verification
              </p>
              <Button 
                onClick={() => window.location.href = '/creator?tab=settings'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Submit Different Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const posts = postsData?.data || [];
  const displayPosts = showAllPosts ? posts : posts.slice(0, 6);

  // Calculate engagement rate
  const avgEngagementRate = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement / page.followersCount * 100), 0) / posts.length
    : 0;

  // Get top performing post
  const topPost = posts.length > 0
    ? posts.reduce((max, p) => p.engagement > max.engagement ? p : max, posts[0])
    : null;

  return (
    <TabsContent value="facebook" className="space-y-6">
      {/* Page Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {page.profilePicture && (
              <img 
                src={page.profilePicture} 
                alt={page.pageName}
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{page.pageName}</h2>
                <Badge variant="default" className="bg-blue-600">
                  <Facebook className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
                {page.isVerified && (
                  <Badge variant="default" className="bg-gray-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Facebook Verified
                  </Badge>
                )}
              </div>
              {page.username && (
                <p className="text-muted-foreground mb-2">@{page.username}</p>
              )}
              <p className="text-sm text-muted-foreground mb-4">{page.category}</p>
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
                  onClick={() => window.open(`https://facebook.com/${page.username || page.pageId}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Page
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Followers</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(page.followersCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Facebook className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Page Likes</p>
                <p className="text-2xl font-bold">
                  {formatNumber(page.likesCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <ThumbsUp className="w-6 h-6 text-purple-600" />
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
      {topPost && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top Performing Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {topPost.image && (
                <div className="relative flex-shrink-0">
                  <img 
                    src={topPost.image} 
                    alt="Top post"
                    className="w-48 h-48 object-cover rounded-lg"
                  />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {topPost.message}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-4 h-4" />
                    {formatNumber(topPost.likes)} likes
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {formatNumber(topPost.comments)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="w-4 h-4" />
                    {formatNumber(topPost.shares)}
                  </span>
                  <span>{formatDate(topPost.createdTime)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.open(topPost.permalink, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Facebook
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Posts</CardTitle>
            {posts.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllPosts(!showAllPosts)}
              >
                {showAllPosts ? 'Show Less' : `View All (${posts.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="flex justify-center py-8">
              <Loading size="md" text="Loading posts..." />
            </div>
          ) : displayPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayPosts.map((post) => (
                <div 
                  key={post.postId}
                  className="group cursor-pointer"
                  onClick={() => window.open(post.permalink, '_blank')}
                >
                  {post.image && (
                    <div className="relative mb-2">
                      <img 
                        src={post.image} 
                        alt="Post"
                        className="w-full aspect-video object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )}
                  <p className="text-sm mb-2 line-clamp-3 group-hover:text-blue-600 transition-colors">
                    {post.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {formatNumber(post.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {formatNumber(post.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      {formatNumber(post.shares)}
                    </span>
                    <span>{formatDate(post.createdTime)}</span>
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
              <span>Last synced: {new Date(page.lastSyncedAt).toLocaleString()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Syncing from Facebook...' : 'Sync Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
