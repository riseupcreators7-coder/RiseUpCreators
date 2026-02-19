import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gavel, Clock, Trophy, DollarSign, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getAuthHeaders } from "@/lib/auth";
import Loading from "@/components/common/loading";

interface Auction {
  _id: string;
  auctionId: number;
  artistId: string;
  nftAddress: string;
  tokenId: number;
  startPrice: string;
  currentBid: string;
  highestBidder: string;
  endTime: string;
  status: "active" | "ended" | "claimed";
  createdAt: string;
  winner?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export default function NFTAuctionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  // Fetch all auctions
  const { data: auctionsData, isLoading } = useQuery<{ auctions: Auction[] }>({
    queryKey: ["/api/marketplace/auctions"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/auctions");
      if (!response.ok) throw new Error("Failed to fetch auctions");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Place bid mutation
  const placeBidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: number; amount: string }) => {
      const response = await fetch("/api/nft/auction/bid", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ auctionId, amount })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to place bid");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/auctions"] });
      setShowBidDialog(false);
      setSelectedAuction(null);
      setBidAmount("");
      toast({
        title: "Success!",
        description: "Bid placed successfully",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to place bid";
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      const isFundingError = errorMessage.includes("funds") || errorMessage.includes("balance");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  const formatPrice = (amount: string) => {
    try {
      const eth = parseFloat(amount);
      return `${eth.toFixed(4)} ETH`;
    } catch {
      return "0 ETH";
    }
  };

  const getTimeRemaining = (endTime: string) => {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const handlePlaceBid = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place bids",
        variant: "destructive"
      });
      return;
    }

    if (!selectedAuction || !bidAmount) {
      toast({
        title: "Error",
        description: "Please enter a bid amount",
        variant: "destructive"
      });
      return;
    }

    const currentBidETH = parseFloat(selectedAuction.currentBid);
    const bidAmountETH = parseFloat(bidAmount);

    if (bidAmountETH <= currentBidETH) {
      toast({
        title: "Error",
        description: "Your bid must be higher than the current bid",
        variant: "destructive"
      });
      return;
    }

    placeBidMutation.mutate({
      auctionId: selectedAuction.auctionId,
      amount: bidAmount
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Loading size="lg" text="Loading auctions..." />
        </div>
      </div>
    );
  }

  const auctions = auctionsData?.auctions || [];
  
  // Separate active and ended auctions
  const now = new Date();
  const activeAuctions = auctions.filter(a => {
    const endTime = new Date(a.endTime);
    return a.status === "active" && endTime > now;
  });
  
  const endedAuctions = auctions.filter(a => {
    const endTime = new Date(a.endTime);
    return a.status === "ended" || (a.status === "active" && endTime <= now);
  });

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <Gavel className="w-8 h-8" />
            NFT Auctions
          </h1>
          <p className="text-muted-foreground">
            Bid on exclusive NFTs from your favorite artists
          </p>
        </div>

        {/* Active Auctions */}
        {activeAuctions.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-green-500" />
              Active Auctions ({activeAuctions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeAuctions.map((auction) => {
                const timeRemaining = getTimeRemaining(auction.endTime);
                const hasEnded = timeRemaining === "Ended";
                
                return (
                  <Card key={auction._id} className="hover:shadow-lg transition-shadow border-green-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Token #{auction.tokenId}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            {auction.nftAddress.slice(0, 6)}...{auction.nftAddress.slice(-4)}
                          </p>
                        </div>
                        <Badge className="bg-green-500">
                          <Clock className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Starting Price:</span>
                          <span className="font-semibold">{formatPrice(auction.startPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Current Bid:</span>
                          <span className="font-semibold text-green-600">{formatPrice(auction.currentBid)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className={`w-4 h-4 ${hasEnded ? 'text-gray-500' : 'text-orange-500'}`} />
                          <span>{timeRemaining}</span>
                        </div>
                        {auction.highestBidder !== "0x0000000000000000000000000000000000000000" && (
                          <div className="flex items-center gap-2 text-sm">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs font-mono">
                              Leading bidder
                            </span>
                          </div>
                        )}
                        <Button
                          className="w-full gradient-primary"
                          onClick={() => {
                            setSelectedAuction(auction);
                            setShowBidDialog(true);
                          }}
                          disabled={hasEnded}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Place Bid
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Ended Auctions */}
        {endedAuctions.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-gray-500" />
              Ended Auctions ({endedAuctions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {endedAuctions.map((auction) => (
                <Card key={auction._id} className="border-gray-200 opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Token #{auction.tokenId}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {auction.nftAddress.slice(0, 6)}...{auction.nftAddress.slice(-4)}
                        </p>
                      </div>
                      <Badge variant="secondary">Ended</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Final Bid:</span>
                        <span className="font-semibold">{formatPrice(auction.currentBid)}</span>
                      </div>
                      {auction.highestBidder !== "0x0000000000000000000000000000000000000000" ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs font-semibold">Winner:</span>
                          </div>
                          {auction.winner ? (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                                {auction.winner.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{auction.winner.name}</p>
                                <p className="text-xs text-muted-foreground">User ID: {auction.highestBidder.slice(0, 8)}...</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground px-2">
                              User ID: {auction.highestBidder}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          No bids placed
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Auctions */}
        {activeAuctions.length === 0 && endedAuctions.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <Gavel className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No auctions available</h3>
                <p className="text-muted-foreground">
                  Check back later for new NFT auctions from artists
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Place Bid Dialog */}
        <Dialog open={showBidDialog} onOpenChange={(open) => {
          setShowBidDialog(open);
          if (!open) {
            setSelectedAuction(null);
            setBidAmount("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Place Bid</DialogTitle>
              {selectedAuction && (
                <p className="text-sm text-muted-foreground">
                  Token #{selectedAuction.tokenId} - Auction #{selectedAuction.auctionId}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              {selectedAuction && (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Current Bid:</span>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          {formatPrice(selectedAuction.currentBid)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Time Remaining:</span>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          {getTimeRemaining(selectedAuction.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!user && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        Please sign in to place a bid on this auction
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Your Bid (in ETH) *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min={parseFloat(selectedAuction.currentBid)}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={(parseFloat(selectedAuction.currentBid) + 0.001).toFixed(3)}
                      disabled={!user}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be higher than current bid
                    </p>
                  </div>

                  <Button
                    onClick={handlePlaceBid}
                    disabled={placeBidMutation.isPending || !user}
                    className="w-full"
                  >
                    {placeBidMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {placeBidMutation.isPending ? "Placing Bid..." : "Place Bid"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
