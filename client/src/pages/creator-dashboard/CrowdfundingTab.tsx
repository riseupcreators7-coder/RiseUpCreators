import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { DollarSign, Plus, Users, TrendingUp, Loader2, CheckCircle, Clock, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getCreatorAuthHeaders } from "./utils";

interface Campaign {
  _id: string;
  campaignId: number;
  creatorId: string;
  goal: string;
  raised: string;
  duration: number;
  endTime: string;
  status: string;
  finalized: boolean;
  transactionHash: string;
  createdAt: string;
}

export default function CrowdfundingTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showPushRevenue, setShowPushRevenue] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [finalizingCampaign, setFinalizingCampaign] = useState<number | null>(null); // Track which campaign is being finalized

  const [campaignForm, setcampaignForm] = useState({
    goal: "",
    hours: "",
    minutes: ""
  });

  const [revenueForm, setRevenueForm] = useState({
    amount: ""
  });

  // Fetch my campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["/api/crowdfunding/my-campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/crowdfunding/my-campaigns", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      return response.json();
    },
    enabled: !!auth.user,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: { goal: string; duration: number }) => {
      const response = await fetch("/api/crowdfunding/create", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crowdfunding/my-campaigns"] });
      setShowCreateCampaign(false);
      setcampaignForm({ goal: "", hours: "", minutes: "" });
      toast({
        title: "Success!",
        description: "Crowdfunding campaign created successfully",
      });
    },
    onError: (error: any) => {
      // Extract the actual error message
      let errorMessage = "Failed to create campaign";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      const isFundingError = errorMessage.includes("funds") || 
                            errorMessage.includes("balance") ||
                            errorMessage.includes("insufficient");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  // Finalize campaign mutation
  const finalizeMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      setFinalizingCampaign(campaignId); // Set which campaign is being finalized
      const response = await fetch("/api/crowdfunding/finalize", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ campaignId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to finalize campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crowdfunding/my-campaigns"] });
      setFinalizingCampaign(null); // Clear the finalizing state
      toast({
        title: "Success!",
        description: "Campaign finalized successfully",
      });
    },
    onError: (error: any) => {
      setFinalizingCampaign(null); // Clear the finalizing state on error
      // Extract the actual error message
      let errorMessage = "Failed to finalize campaign";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      const isNotEnded = errorMessage.includes("not ended") || 
                        errorMessage.includes("Campaign not ended");
      
      toast({
        title: "Error",
        description: isNotEnded 
          ? "The campaign hasn't ended yet. Please wait until the deadline passes."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  // Push revenue mutation
  const pushRevenueMutation = useMutation({
    mutationFn: async (data: { campaignId: number; amount: string }) => {
      const response = await fetch("/api/crowdfunding/push-revenue", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to push revenue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crowdfunding/my-campaigns"] });
      setShowPushRevenue(false);
      setRevenueForm({ amount: "" });
      setSelectedCampaign(null);
      toast({
        title: "Success!",
        description: "Revenue distributed successfully",
      });
    },
    onError: (error: any) => {
      // Extract the actual error message
      let errorMessage = "Failed to push revenue";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Check for common error types
      const isFundingError = errorMessage.includes("funds") || 
                            errorMessage.includes("balance") ||
                            errorMessage.includes("insufficient");
      
      const isNotSuccessful = errorMessage.includes("not successful") || 
                             errorMessage.includes("Campaign not successful");
      
      const isNotFinalized = errorMessage.includes("not finalized") || 
                            errorMessage.includes("Campaign not finalized");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : isNotSuccessful
          ? "This campaign did not reach its funding goal and cannot receive revenue."
          : isNotFinalized
          ? "Please finalize the campaign before pushing revenue."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  const campaigns = campaignsData?.campaigns || [];

  const handleCreateCampaign = () => {
    if (!campaignForm.goal) {
      toast({
        title: "Error",
        description: "Please enter a funding goal",
        variant: "destructive"
      });
      return;
    }

    const hours = parseInt(campaignForm.hours) || 0;
    const minutes = parseInt(campaignForm.minutes) || 0;
    const durationInSeconds = (hours * 3600) + (minutes * 60);

    if (durationInSeconds <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid duration",
        variant: "destructive"
      });
      return;
    }

    // Send goal as plain number string (API will handle conversion)
    createCampaignMutation.mutate({
      goal: campaignForm.goal,
      duration: durationInSeconds
    });
  };

  const handlePushRevenue = () => {
    if (!selectedCampaign || !revenueForm.amount) {
      toast({
        title: "Error",
        description: "Please enter revenue amount",
        variant: "destructive"
      });
      return;
    }

    // Send amount as plain number string (API will handle conversion)
    pushRevenueMutation.mutate({
      campaignId: selectedCampaign.campaignId,
      amount: revenueForm.amount
    });
  };

  const isExpired = (endTime: string) => new Date(endTime) < new Date();
  const formatTimeRemaining = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  if (campaignsLoading) {
    return (
      <TabsContent value="crowdfunding">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading campaigns..." />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="crowdfunding" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Crowdfunding Campaigns</h2>
          <p className="text-muted-foreground">Create campaigns and share revenue with supporters</p>
        </div>
        <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Crowdfunding Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Funding Goal (ETH) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={campaignForm.goal}
                  onChange={(e) => setcampaignForm({ ...campaignForm, goal: e.target.value })}
                  placeholder="4"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    value={campaignForm.hours}
                    onChange={(e) => setcampaignForm({ ...campaignForm, hours: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    value={campaignForm.minutes}
                    onChange={(e) => setcampaignForm({ ...campaignForm, minutes: e.target.value })}
                    placeholder="60"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateCampaign}
                disabled={createCampaignMutation.isPending}
                className="w-full"
              >
                {createCampaignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaigns List */}
      {campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign) => {
            // Handle both wei and plain number formats
            const goalNum = parseFloat(campaign.goal);
            const raisedNum = parseFloat(campaign.raised || "0");
            
            // If the number is very large (> 1000), it's likely in wei, so convert it
            const goalInEth = goalNum > 1000 ? (goalNum / 1e18).toFixed(2) : goalNum.toFixed(2);
            const raisedInEth = raisedNum > 1000 ? (raisedNum / 1e18).toFixed(2) : raisedNum.toFixed(2);
            
            const progress = (raisedNum / goalNum) * 100;
            const expired = isExpired(campaign.endTime);
            const canFinalize = expired && !campaign.finalized;

            return (
              <Card key={campaign._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Campaign #{campaign.campaignId}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatTimeRemaining(campaign.endTime)}
                      </p>
                    </div>
                    <Badge variant={campaign.finalized ? "default" : expired ? "secondary" : "outline"}>
                      {campaign.finalized ? "Finalized" : expired ? "Ended" : "Active"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Raised</p>
                      <p className="font-semibold break-words">{raisedInEth} ETH</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Goal</p>
                      <p className="font-semibold break-words">{goalInEth} ETH</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {canFinalize && (
                      <Button
                        onClick={() => finalizeMutation.mutate(campaign.campaignId)}
                        disabled={finalizingCampaign === campaign.campaignId}
                        variant="outline"
                        className="flex-1"
                      >
                        {finalizingCampaign === campaign.campaignId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Finalize
                      </Button>
                    )}
                    {campaign.finalized && (
                      <Button
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setShowPushRevenue(true);
                        }}
                        className="flex-1 gradient-primary"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Push Revenue
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first crowdfunding campaign to raise funds from supporters
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Push Revenue Dialog */}
      <Dialog open={showPushRevenue} onOpenChange={setShowPushRevenue}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push Revenue to Campaign #{selectedCampaign?.campaignId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Revenue will be distributed proportionally to all contributors based on their contribution amount.
              </p>
            </div>
            <div>
              <Label>Revenue Amount (ETH) *</Label>
              <Input
                type="number"
                step="0.01"
                value={revenueForm.amount}
                onChange={(e) => setRevenueForm({ amount: e.target.value })}
                placeholder="0.2"
              />
            </div>
            <Button
              onClick={handlePushRevenue}
              disabled={pushRevenueMutation.isPending}
              className="w-full"
            >
              {pushRevenueMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Push Revenue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
