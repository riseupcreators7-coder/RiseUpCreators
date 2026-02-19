import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { Video, RefreshCw, ExternalLink, Eye, ThumbsUp, MessageSquare, Play, TrendingUp, CheckCircle } from "lucide-react";
import { getCreatorAuthHeaders } from "./utils";
import { useState } from "react";
import Loading from "@/components/common/loading";
import { toast } from "@/hooks/use-toast";

interface YouTubeChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
  description: string;
  customUrl: string;
  country: string;
  verificationStatus: "pending" | "verified" | "rejected";
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  submittedAt?: string;
  lastSyncedAt: string;
  isYouTubeVerified?: boolean; // Official YouTube verification badge
}

interface YouTubeVideo {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    maxres: string;
  };
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
}

export default function YouTubeTab() {
  const auth = useRequireRole("artist");
  const [showAllVideos, setShowAllVideos] = useState(false);
  const queryClient = useQueryClient();

  // Fetch YouTube channel data
  const { data: youtubeData, isLoading: youtubeLoading, refetch: refetchChannel } = useQuery<{ 
    success: boolean; 
    hasChannel: boolean; 
    data?: YouTubeChannel 
  }>({
    queryKey: ["/api/creators/youtube"],
    queryFn: async () => {
      const response = await fetch("/api/creators/youtube", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, hasChannel: false };
        }
        throw new Error("Failed to fetch YouTube data");
      }
      return response.json();
    },
    enabled: !!auth.user,
    retry: false, // Don't retry 404s
  });

  // Fetch YouTube videos
  const { data: videosData, isLoading: videosLoading, refetch: refetchVideos, error: videosError } = useQuery<{
    success: boolean;
    data: YouTubeVideo[];
  }>({
    queryKey: ["/api/creators/youtube/videos", showAllVideos ? 50 : 12],
    queryFn: async () => {
      console.log('Fetching YouTube videos...');
      // Add fresh=true parameter to bypass cache after refresh
      const freshParam = refreshMutation.isSuccess ? '&fresh=true' : '';
      const response = await fetch(`/api/creators/youtube/videos?limit=${showAllVideos ? 50 : 12}${freshParam}`, {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch videos:', response.status, errorText);
        throw new Error("Failed to fetch YouTube videos");
      }
      const data = await response.json();
      console.log('YouTube videos fetched:', data);
      return data;
    },
    enabled: !!auth.user && youtubeData?.hasChannel === true,
    staleTime: 0, // Always consider data stale to allow fresh fetches
  });

  // Refresh YouTube data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 Starting YouTube data refresh...');
      const response = await fetch("/api/creators/youtube/refresh", {
        method: "POST",
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to refresh YouTube data");
      }
      const data = await response.json();
      console.log('✅ YouTube data refreshed:', data);
      return data;
    },
    onSuccess: async (data) => {
      console.log('🔄 Invalidating cache and refetching...');
      
      // Remove all YouTube-related queries from cache
      queryClient.removeQueries({ queryKey: ["/api/creators/youtube"] });
      queryClient.removeQueries({ queryKey: ["/api/creators/youtube/videos"] });
      queryClient.removeQueries({ queryKey: ["artistProfile"] });
      
      // Wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Manually refetch with fresh data
      await refetchChannel();
      await refetchVideos();
      
      toast({
        title: "Success!",
        description: `YouTube data synced! ${data.data?.subscriberCount || 0} subscribers, ${data.data?.videoCount || 0} videos`,
        duration: 5000
      });
    },
    onError: (error: Error) => {
      console.error('❌ Refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh YouTube data",
        variant: "destructive"
      });
    }
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDuration = (duration: string): string => {
    // Parse ISO 8601 duration (PT1H2M10S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  if (youtubeLoading) {
    return (
      <TabsContent value="youtube">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading YouTube data..." />
        </div>
      </TabsContent>
    );
  }

  if (!youtubeData?.hasChannel || !youtubeData.data) {
    return (
      <TabsContent value="youtube">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Video className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No YouTube Channel Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your YouTube channel to display your content and statistics
              </p>
              <Button 
                onClick={() => window.location.href = '/creator?tab=settings'}
                className="bg-red-600 hover:bg-red-700"
              >
                <Video className="w-4 h-4 mr-2" />
                Connect YouTube Channel
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const channel = youtubeData.data;

  // Debug: Log channel data to verify isYouTubeVerified field
  console.log('📺 YouTube Channel Data:', {
    channelName: channel.channelName,
    verificationStatus: channel.verificationStatus,
    isYouTubeVerified: channel.isYouTubeVerified,
    fullData: channel
  });

  // Check verification status - only show data if verified
  if (channel.verificationStatus === "pending") {
    return (
      <TabsContent value="youtube">
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
                Your YouTube channel verification is under review by our admin team. 
                You'll receive an email notification once it's reviewed (typically within 24-48 hours).
              </p>
              <div className="p-4 bg-white rounded-lg text-left max-w-md mx-auto mb-4">
                <p className="text-sm font-medium mb-2">Channel Details:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Channel:</strong> {channel.channelName}</p>
                  <p><strong>Subscribers:</strong> {channel.subscriberCount.toLocaleString()}</p>
                  <p><strong>Submitted:</strong> {channel.submittedAt ? new Date(channel.submittedAt).toLocaleDateString() : 'Recently'}</p>
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

  if (channel.verificationStatus === "rejected") {
    return (
      <TabsContent value="youtube">
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
                Your YouTube channel verification was not approved.
              </p>
              {channel.rejectionReason && (
                <div className="p-4 bg-red-100 border border-red-200 rounded-lg text-left max-w-md mx-auto mb-4">
                  <p className="text-sm font-medium text-red-900 mb-1">Reason:</p>
                  <p className="text-sm text-red-700">{channel.rejectionReason}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-4">
                You can submit a different YouTube channel for verification
              </p>
              <Button 
                onClick={() => window.location.href = '/creator?tab=settings'}
                className="bg-red-600 hover:bg-red-700"
              >
                Submit Different Channel
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  // Only show full YouTube data if verified
  if (channel.verificationStatus !== "verified") {
    return (
      <TabsContent value="youtube">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Video className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">YouTube Channel Not Verified</h3>
              <p className="text-muted-foreground mb-4">
                Your YouTube channel needs to be verified before you can access statistics
              </p>
              <Button 
                onClick={() => window.location.href = '/creator?tab=settings'}
                className="bg-red-600 hover:bg-red-700"
              >
                Go to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }
  const videos = videosData?.data || [];
  const displayVideos = showAllVideos ? videos : videos.slice(0, 6);

  console.log('YouTube Tab State:', {
    hasChannel: youtubeData?.hasChannel,
    channelData: channel,
    videosLoading,
    videosError,
    videosCount: videos.length,
    videosData
  });

  // Calculate engagement rate
  const avgEngagementRate = videos.length > 0
    ? videos.reduce((sum, v) => sum + ((v.likeCount + v.commentCount) / v.viewCount * 100), 0) / videos.length
    : 0;

  // Get top performing video
  const topVideo = videos.length > 0
    ? videos.reduce((max, v) => v.viewCount > max.viewCount ? v : max, videos[0])
    : null;

  return (
    <TabsContent value="youtube" className="space-y-6">
      {/* Channel Header */}
      <Card className="border-red-200 bg-gradient-to-r from-red-50 to-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {channel.thumbnails?.high && (
              <img 
                src={channel.thumbnails.high} 
                alt={channel.channelName}
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{channel.channelName}</h2>
                <Badge variant="default" className="bg-red-600">
                  <Video className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
              {channel.customUrl && (
                <p className="text-muted-foreground mb-2">@{channel.customUrl}</p>
              )}
              {channel.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {channel.description}
                </p>
              )}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshMutation.isPending ? 'Syncing...' : 'Refresh Data'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(channel.channelUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Channel
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
                <p className="text-sm text-muted-foreground">Subscribers</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(channel.subscriberCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Video className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Videos</p>
                <p className="text-2xl font-bold">
                  {formatNumber(channel.videoCount)}
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
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">
                  {formatNumber(channel.viewCount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Eye className="w-6 h-6 text-purple-600" />
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

      {/* Top Performing Video */}
      {topVideo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top Performing Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-shrink-0">
                <img 
                  src={topVideo.thumbnails.high} 
                  alt={topVideo.title}
                  className="w-48 h-27 object-cover rounded-lg"
                />
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(topVideo.duration)}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2 line-clamp-2">{topVideo.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {topVideo.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {formatNumber(topVideo.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-4 h-4" />
                    {formatNumber(topVideo.likeCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {formatNumber(topVideo.commentCount)}
                  </span>
                  <span>{formatDate(topVideo.publishedAt)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${topVideo.videoId}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch on YouTube
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Videos Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Videos</CardTitle>
            {videos.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllVideos(!showAllVideos)}
              >
                {showAllVideos ? 'Show Less' : `View All (${videos.length})`}
              </Button>
            )}
          </div>
          {/* Debug Info */}
          {videosError && (
            <div className="text-sm text-red-600 mt-2">
              Error loading videos: {(videosError as Error).message}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {videosLoading ? (
            <div className="flex justify-center py-8">
              <Loading size="md" text="Loading videos..." />
            </div>
          ) : displayVideos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No videos found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayVideos.map((video) => (
                <div 
                  key={video.videoId}
                  className="group cursor-pointer"
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank')}
                >
                  <div className="relative mb-2">
                    <img 
                      src={video.thumbnails.high} 
                      alt={video.title}
                      className="w-full aspect-video object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(video.duration)}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <h4 className="font-medium line-clamp-2 mb-1 group-hover:text-red-600 transition-colors">
                    {video.title}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(video.viewCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {formatNumber(video.likeCount)}
                    </span>
                    <span>{formatDate(video.publishedAt)}</span>
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
              <span>Last synced: {new Date(channel.lastSyncedAt).toLocaleString()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Syncing from YouTube...' : 'Sync Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
