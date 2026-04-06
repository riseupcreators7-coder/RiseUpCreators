import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { DollarSign, Target, TrendingUp, Loader2, Clock, Users, Gift, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getAuthHeaders } from "@/lib/auth";

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
  creator?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface Contribution {
  _id: string;
  campaignId: number;
  contributorId: string;
  amount: string;
  transactionHash: string;
  createdAt: string;
  campaign?: Campaign;
}

export default function CrowdfundingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showContribute, setShowContribute] = useState(false);
  const [showClaimNFT, setShowClaimNFT] = useState(false);
  const [showClaimRevenue, setShowClaimRevenue] = useState(false);
  const [contributeAmount, setContributeAmount] = useState("");

  // Fetch all campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["/api/crowdfunding/list"],
    queryFn: async () => {
      const response = await fetch("/api/crowdfunding/list");
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      return response.json();
    },
    refetchInterval: 30000
  });

  // Fetch my contributions
  const { data: contributionsData, isLoading: contributionsLoading } = useQuery<{ contributions: Contribution[] }>({
    queryKey: ["/api/crowdfunding/my-contributions"],
    queryFn: async () => {
      const response = await fetch("/api/crowdfunding/my-contributions", {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch contributions");
      return response.json();
    },
    enabled: !!user,
  });

  // Contribute mutation
  const contributeMutation = useMutation({
    mutationFn: async (data: { campaignId: number; amount: string }) => {
      const response = await fetch("/api/crowdfunding/contribute", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to contribute");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crowdfunding/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crowdfunding/my-contributions"] });
      setShowContribute(false);
      setContributeAmount("");
      setSelectedCampaign(null);
      toast({
        title: "Success!",
        description: "Contribution successful! Thank you for your support.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Claim NFT mutation
  const claimNFTMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch("/api/crowdfunding/claim-nft", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ campaignId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim NFT");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowClaimNFT(false);
      setSelectedCampaign(null);
      toast({
        title: "Success!",
        description: "NFT reward claimed successfully!",
      });
    },
    onError: (error: Error) => {
      // Close the dialog
      setShowClaimNFT(false);
      setSelectedCampaign(null);
      
      // Show friendly notification
      const isAlreadyClaimed = error.message.includes("already claimed");
      toast({
        title: isAlreadyClaimed ? "Already Claimed" : "Unable to Claim",
        description: error.message,
        variant: isAlreadyClaimed ? "default" : "destructive"
      });
    }
  });

  // Claim revenue mutation
  const claimRevenueMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch("/api/crowdfunding/claim-revenue", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ campaignId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim revenue");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowClaimRevenue(false);
      setSelectedCampaign(null);
      toast({
        title: "Success!",
        description: "Revenue claimed successfully!",
      });
    },
    onError: (error: Error) => {
      // Close the dialog
      setShowClaimRevenue(false);
      setSelectedCampaign(null);
      
      // Show friendly notification
      const isAlreadyClaimed = error.message.includes("already claimed");
      const isNothingToClaim = error.message.includes("Nothing to claim") || error.message.includes("No revenue");
      toast({
        title: isAlreadyClaimed ? "Already Claimed" : isNothingToClaim ? "Nothing to Claim" : "Unable to Claim",
        description: error.message,
        variant: (isAlreadyClaimed || isNothingToClaim) ? "default" : "destructive"
      });
    }
  });

  const campaigns = campaignsData?.campaigns || [];
  const myContributions = contributionsData?.contributions || [];
  const contributedCampaignIds = new Set(myContributions.map(c => c.campaignId));

  const handleContribute = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to contribute to campaigns",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCampaign || !contributeAmount) {
      toast({
        title: "Error",
        description: "Please enter contribution amount",
        variant: "destructive"
      });
      return;
    }

    // Send amount as plain number string (API will handle conversion)
    contributeMutation.mutate({
      campaignId: selectedCampaign.campaignId,
      amount: contributeAmount
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

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Crowdfunding Campaigns</h1>
          <p className="text-muted-foreground">
            Support your favorite artists and earn rewards
          </p>
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse">Browse Campaigns</TabsTrigger>
            {user && <TabsTrigger value="my-contributions">My Contributions</TabsTrigger>}
          </TabsList>

          {/* Browse Campaigns Tab */}
          <TabsContent value="browse" className="space-y-6">
            {campaignsLoading ? (
              <div className="flex justify-center py-12">
                <Loading size="lg" text="Loading campaigns..." />
              </div>
            ) : campaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((campaign) => {
                  // Handle both wei and plain number formats
                  const goalNum = parseFloat(campaign.goal);
                  const raisedNum = parseFloat(campaign.raised || "0");
                  
                  // If the number is very large (> 1000), it's likely in wei, so convert it
                  const goalInEth = goalNum > 1000 ? (goalNum / 1e18).toFixed(2) : goalNum.toFixed(2);
                  const raisedInEth = raisedNum > 1000 ? (raisedNum / 1e18).toFixed(2) : raisedNum.toFixed(2);
                  
                  const progress = (raisedNum / goalNum) * 100;
                  const expired = isExpired(campaign.endTime);
                  const hasContributed = contributedCampaignIds.has(campaign.campaignId);

                  return (
                    <Card key={campaign._id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {campaign.creator?.name || "Unknown Artist"}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Campaign #{campaign.campaignId}
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
                         <p className="font-semibold">{goalInEth} ETH</p>
                          </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {formatTimeRemaining(campaign.endTime)}
                        </div>

                        {!expired && (
                          <Button
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowContribute(true);
                            }}
                            className="w-full gradient-primary"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Contribute
                          </Button>
                        )}

                        {hasContributed && campaign.finalized && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setSelectedCampaign(campaign);
                                setShowClaimNFT(true);
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              <Gift className="w-4 h-4 mr-2" />
                              Claim NFT
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedCampaign(campaign);
                                setShowClaimRevenue(true);
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Claim Revenue
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12">
                  <div className="text-center">
                    <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No campaigns available</h3>
                    <p className="text-muted-foreground">
                      Check back later for new crowdfunding campaigns
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Contributions Tab */}
          {user && (
            <TabsContent value="my-contributions" className="space-y-6">
              {contributionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loading size="lg" text="Loading contributions..." />
                </div>
              ) : myContributions.length > 0 ? (
                <div className="space-y-4">
                  {myContributions.map((contribution) => {
                    // Handle both wei and plain number formats
                    const amountNum = parseFloat(contribution.amount);
                    const amountInEth = amountNum > 1000 ? (amountNum / 1e18).toFixed(4) : amountNum.toFixed(4);
                    const campaign = contribution.campaign;

                    return (
                      <Card key={contribution._id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Campaign #{contribution.campaignId}</p>
                              <p className="text-sm text-muted-foreground">
                                Contributed {amountInEth} ETH
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(contribution.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={campaign?.finalized ? "default" : "secondary"}>
                              {campaign?.finalized ? "Finalized" : "Active"}
                            </Badge>
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
                      <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No contributions yet</h3>
                      <p className="text-muted-foreground">
                        Start supporting artists by contributing to their campaigns
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Contribute Dialog */}
        <Dialog open={showContribute} onOpenChange={setShowContribute}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contribute to Campaign #{selectedCampaign?.campaignId}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Support {selectedCampaign?.creator?.name} and earn rewards when the campaign succeeds!
                </p>
              </div>
              <div>
                <Label>Contribution Amount (ETH) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  placeholder="1"
                />
              </div>
              <Button
                onClick={handleContribute}
                disabled={contributeMutation.isPending}
                className="w-full"
              >
                {contributeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Contribute
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Claim NFT Dialog */}
        <Dialog open={showClaimNFT} onOpenChange={setShowClaimNFT}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim NFT Reward</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Claim your exclusive NFT reward for supporting Campaign #{selectedCampaign?.campaignId}!
                </p>
              </div>
              <Button
                onClick={() => selectedCampaign && claimNFTMutation.mutate(selectedCampaign.campaignId)}
                disabled={claimNFTMutation.isPending}
                className="w-full"
              >
                {claimNFTMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Claim NFT
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Claim Revenue Dialog */}
        <Dialog open={showClaimRevenue} onOpenChange={setShowClaimRevenue}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim Revenue Share</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  Claim your proportional share of revenue from Campaign #{selectedCampaign?.campaignId}!
                </p>
              </div>
              <Button
                onClick={() => selectedCampaign && claimRevenueMutation.mutate(selectedCampaign.campaignId)}
                disabled={claimRevenueMutation.isPending}
                className="w-full"
              >
                {claimRevenueMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Claim Revenue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
