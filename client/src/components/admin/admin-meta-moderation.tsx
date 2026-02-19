import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Facebook, Instagram, CheckCircle, XCircle, Flag, ExternalLink, MessageSquare, Heart, Share2 } from "lucide-react";
import Loading from "@/components/common/loading";
import { useToast } from "@/hooks/use-toast";

export default function AdminMetaModeration() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("90"); // Changed from "7" to "90"
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [moderationAction, setModerationAction] = useState<string>("");
  const [moderationNotes, setModerationNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch moderation stats
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/meta/content/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/meta/content/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Fetch recent content
  const { data: contentData, isLoading: contentLoading, refetch, error: contentError } = useQuery({
    queryKey: ["/api/admin/meta/content/recent", platformFilter, daysFilter],
    queryFn: async () => {
      console.log('🔍 Fetching content from API...', { platformFilter, daysFilter });
      const res = await fetch(
        `/api/admin/meta/content/recent?platform=${platformFilter}&days=${daysFilter}&limit=50`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
        }
      );
      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.message || "Failed to fetch content");
      }
      const data = await res.json();
      console.log('✅ Content fetched:', data);
      return data;
    },
  });

  // Fetch moderation status for posts
  const { data: statusData } = useQuery({
    queryKey: ["/api/admin/meta/content/status", contentData?.data],
    queryFn: async () => {
      const posts = contentData?.data || [];
      if (posts.length === 0) return { data: {} };
      
      const postIds = posts.map((p: any) => p.postId);
      const res = await fetch("/api/admin/meta/content/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({ postIds }),
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!contentData?.data && contentData.data.length > 0,
  });

  // Moderate content mutation
  const moderateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/meta/content/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to moderate content");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/meta/content/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/meta/content/status"] });
      toast({
        title: "Success",
        description: "Content moderated successfully",
      });
      setDialogOpen(false);
      setModerationNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to moderate content",
        variant: "destructive",
      });
    },
  });

  const handleModerate = (post: any, action: string) => {
    setSelectedPost(post);
    setModerationAction(action);
    setDialogOpen(true);
  };

  const confirmModeration = () => {
    if (!selectedPost) return;

    moderateMutation.mutate({
      postId: selectedPost.postId,
      platform: selectedPost.platform,
      action: moderationAction,
      notes: moderationNotes,
      artistUserId: selectedPost.artist.userId,
    });
  };

  const getStatusBadge = (postId: string) => {
    const status = statusData?.data?.[postId];
    if (!status) return null;

    const variants: any = {
      approved: { variant: "default", label: "Approved", color: "text-green-600" },
      rejected: { variant: "destructive", label: "Rejected", color: "text-red-600" },
      flagged: { variant: "secondary", label: "Flagged", color: "text-yellow-600" },
    };

    const config = variants[status.status];
    if (!config) return null;

    return (
      <Badge variant={config.variant as any} className="ml-2">
        {config.label}
      </Badge>
    );
  };

  const content = contentData?.data || [];
  const moderationStats = stats?.data || { total: 0, pending: 0, approved: 0, rejected: 0, flagged: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Content Moderation</h2>
        <p className="text-muted-foreground">Review and moderate content from all artists</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moderationStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moderationStats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moderationStats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moderationStats.rejected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Flagged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moderationStats.flagged}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook Only</SelectItem>
                <SelectItem value="instagram">Instagram Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 Hours</SelectItem>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => refetch()} variant="outline">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div>
        {contentLoading ? (
          <Loading text="Loading content..." />
        ) : contentError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600 font-medium mb-2">Error loading content</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(contentError as any)?.message || "Failed to fetch content"}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : content.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No content found for the selected filters</p>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting the time range or platform filter
              </p>
              <div className="text-xs text-muted-foreground mt-4">
                <p>Debug info:</p>
                <p>Platform: {platformFilter}</p>
                <p>Days: {daysFilter}</p>
                <p>Total items: {contentData?.total || 0}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.map((post: any) => (
              <Card key={post.postId} className="overflow-hidden">
                {/* Post Image */}
                {post.image && (
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={post.image}
                      alt="Post content"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      {post.platform === 'facebook' ? (
                        <Badge className="bg-blue-600">
                          <Facebook className="w-3 h-3 mr-1" />
                          Facebook
                        </Badge>
                      ) : (
                        <Badge className="bg-pink-600">
                          <Instagram className="w-3 h-3 mr-1" />
                          Instagram
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <CardContent className="p-4 space-y-3">
                  {/* Artist Info */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{post.artist.artistName}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(post.createdTime).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(post.postId)}
                  </div>

                  {/* Post Message */}
                  {post.message && (
                    <p className="text-sm line-clamp-3">{post.message}</p>
                  )}

                  {/* Engagement Stats */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {post.comments}
                    </span>
                    {post.shares > 0 && (
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {post.shares}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-green-600 hover:bg-green-50"
                      onClick={() => handleModerate(post, 'approve')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50"
                      onClick={() => handleModerate(post, 'reject')}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-yellow-600 hover:bg-yellow-50"
                      onClick={() => handleModerate(post, 'flag')}
                    >
                      <Flag className="w-4 h-4 mr-1" />
                      Flag
                    </Button>
                  </div>

                  {/* View Original Link */}
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    View Original
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Moderation Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationAction === 'approve' && 'Approve Content'}
              {moderationAction === 'reject' && 'Reject Content'}
              {moderationAction === 'flag' && 'Flag Content'}
            </DialogTitle>
            <DialogDescription>
              {moderationAction === 'approve' && 'This content will be marked as approved and can be featured on the platform.'}
              {moderationAction === 'reject' && 'This content will be marked as rejected and hidden from platform features.'}
              {moderationAction === 'flag' && 'This content will be flagged for further review.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedPost && (
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium">{selectedPost.artist.artistName}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {selectedPost.message || 'No caption'}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add notes about this moderation decision..."
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmModeration} disabled={moderateMutation.isPending}>
              {moderateMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
