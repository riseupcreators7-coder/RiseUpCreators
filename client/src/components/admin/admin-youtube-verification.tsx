import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Video, CheckCircle, XCircle, Clock, ExternalLink, User, Mail, Calendar } from "lucide-react";
import Loading from "@/components/common/loading";

export default function AdminYouTubeVerification() {
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch pending YouTube verifications
  const { data: pendingVerifications, isLoading } = useQuery({
    queryKey: ["/api/admin/youtube-verifications/pending"],
    queryFn: async () => {
      const response = await fetch("/api/admin/youtube-verifications/pending", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) throw new Error("Failed to fetch pending verifications");
      return response.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/youtube-verifications/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to approve verification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/youtube-verifications/pending"] });
      toast({
        title: "Approved!",
        description: "YouTube channel verification approved successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve verification",
        variant: "destructive"
      });
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/admin/youtube-verifications/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error('Failed to reject verification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/youtube-verifications/pending"] });
      setRejectionReasons({});
      toast({
        title: "Rejected",
        description: "YouTube channel verification rejected"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject verification",
        variant: "destructive"
      });
    }
  });

  const handleApprove = (requestId: string) => {
    if (confirm("Are you sure you want to approve this YouTube channel verification?")) {
      approveMutation.mutate(requestId);
    }
  };

  const handleReject = (requestId: string) => {
    const reason = rejectionReasons[requestId];
    if (!reason || reason.trim() === "") {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive"
      });
      return;
    }
    if (confirm("Are you sure you want to reject this YouTube channel verification?")) {
      rejectMutation.mutate({ requestId, reason });
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.ceil(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loading size="lg" text="Loading pending verifications..." />
      </div>
    );
  }

  const requests = pendingVerifications?.requests || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">YouTube Channel Verifications</h2>
          <p className="text-muted-foreground">
            Review and approve artist YouTube channel claims
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Clock className="w-4 h-4 mr-2" />
          {requests.length} Pending
        </Badge>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending YouTube channel verifications at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <Card key={request._id} className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Channel Thumbnail */}
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={request.thumbnails?.high || request.thumbnails?.medium} />
                      <AvatarFallback>
                        <Video className="w-8 h-8" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Channel Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold">{request.channelName}</h3>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <Video className="w-3 h-3 mr-1" />
                          YouTube
                        </Badge>
                      </div>
                      
                      {request.customUrl && (
                        <p className="text-sm text-muted-foreground mb-2">
                          @{request.customUrl}
                        </p>
                      )}

                      {/* Channel Stats */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {formatNumber(request.subscriberCount)} subscribers
                        </span>
                        <span>•</span>
                        <span>{formatNumber(request.videoCount)} videos</span>
                        <span>•</span>
                        <span>{formatNumber(request.viewCount)} views</span>
                      </div>

                      {/* Artist Info */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Artist:</span>
                          <span>{request.artistName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Email:</span>
                          <span>{request.artistEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Submitted:</span>
                          <span>{formatDate(request.submittedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending Review
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(request.channelUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Channel on YouTube
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/artist/${request.artistId}`, '_blank')}
                  >
                    <User className="w-4 h-4 mr-2" />
                    View Artist Profile
                  </Button>
                </div>

                {/* Rejection Reason Input */}
                <div className="space-y-2">
                  <Label htmlFor={`reason-${request._id}`}>
                    Rejection Reason (required if rejecting)
                  </Label>
                  <Textarea
                    id={`reason-${request._id}`}
                    placeholder="e.g., Channel name doesn't match artist name, suspected impersonation, etc."
                    value={rejectionReasons[request._id] || ""}
                    onChange={(e) => setRejectionReasons(prev => ({
                      ...prev,
                      [request._id]: e.target.value
                    }))}
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => handleApprove(request._id)}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {approveMutation.isPending ? "Approving..." : "Approve Verification"}
                  </Button>
                  <Button
                    onClick={() => handleReject(request._id)}
                    disabled={rejectMutation.isPending}
                    variant="destructive"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject Verification"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
