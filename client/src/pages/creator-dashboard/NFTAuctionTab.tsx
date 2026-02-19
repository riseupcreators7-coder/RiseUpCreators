import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { Gavel, Plus, Clock, DollarSign, Trophy, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getCreatorAuthHeaders } from "./utils";

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

interface NFTCollection {
  _id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  totalMinted: number;
}

interface NFT {
  _id: string;
  collectionId: string;
  tokenId: number;
  name: string;
  description: string;
  imageHash: string;
  isListed: boolean;
}

export default function NFTAuctionTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [showCreateAuction, setShowCreateAuction] = useState(false);
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [claimingAuction, setClaimingAuction] = useState<number | null>(null); // Track which auction is being claimed

  const [auctionForm, setAuctionForm] = useState({
    startPriceETH: "",
    durationHours: 24
  });

  const [bidForm, setBidForm] = useState({
    amountETH: ""
  });

  // Fetch collections
  const { data: collections } = useQuery<NFTCollection[]>({
    queryKey: ["/api/nft/collections"],
    queryFn: async () => {
      const response = await fetch("/api/nft/collections", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch collections");
      const data = await response.json();
      return data.collections || [];
    },
    enabled: !!auth.user,
  });

  // Fetch NFTs for selected collection
  const { data: nfts, isLoading: nftsLoading } = useQuery<NFT[]>({
    queryKey: ["/api/nft/nfts", selectedCollection],
    queryFn: async () => {
      if (!selectedCollection) return [];
      console.log("Fetching NFTs for collection:", selectedCollection);
      const response = await fetch(`/api/nft/nfts/${selectedCollection}`, {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch NFTs");
      const data = await response.json();
      console.log("NFTs fetched:", data.nfts);
      return data.nfts || [];
    },
    enabled: !!auth.user && !!selectedCollection,
  });

  // Get all NFTs - all can be auctioned
  const allNFTs = nfts || [];

  // Fetch ALL auctions (public + own)
  const { data: auctionsData, isLoading: auctionsLoading } = useQuery<{ auctions: Auction[] }>({
    queryKey: ["/api/marketplace/auctions"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/auctions");
      if (!response.ok) throw new Error("Failed to fetch auctions");
      return response.json();
    },
    enabled: !!auth.user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const auctions = auctionsData?.auctions || [];

  // Separate active and ended auctions based on current time
  const now = new Date();
  const activeAuctions = auctions.filter(a => {
    const endTime = new Date(a.endTime);
    return a.status === "active" && endTime > now;
  });
  
  const endedAuctions = auctions.filter(a => {
    const endTime = new Date(a.endTime);
    return a.status === "ended" || (a.status === "active" && endTime <= now);
  });

  // Place bid mutation
  const placeBidMutation = useMutation({
    mutationFn: async (data: { auctionId: number; amount: string }) => {
      const response = await fetch("/api/nft/auction/bid", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to place bid");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/auctions"] });
      setShowBidDialog(false);
      setSelectedAuction(null);
      setBidForm({ amountETH: "" });
      toast({
        title: "Success!",
        description: "Bid placed successfully",
      });
    },
    onError: (error: Error) => {
      const isFundingError = error.message.includes("funds") || 
                            error.message.includes("balance") ||
                            error.message.includes("insufficient") ||
                            error.message.includes("Sender doesn't have enough funds");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.message,
        variant: "destructive"
      });
    }
  });

  // Claim auction mutation
  const claimAuctionMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      setClaimingAuction(auctionId); // Set which auction is being claimed
      const response = await fetch("/api/nft/auction/claim", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ auctionId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to claim auction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/auctions"] });
      setClaimingAuction(null); // Clear the claiming state
      toast({
        title: "Success!",
        description: "NFT claimed successfully!",
      });
    },
    onError: (error: Error) => {
      setClaimingAuction(null); // Clear the claiming state on error
      
      // Extract and format error message
      let errorMessage = error.message || "Failed to claim NFT";
      
      // Check for common error patterns
      const isOwnershipError = errorMessage.includes("not token owner") || 
                              errorMessage.includes("caller is not token owner");
      
      const isAlreadyClaimedError = errorMessage.includes("already claimed") ||
                                   errorMessage.includes("Auction already claimed");
      
      const isNotEndedError = errorMessage.includes("not ended") ||
                             errorMessage.includes("Auction not ended");
      
      const isNotWinnerError = errorMessage.includes("not winner") ||
                              errorMessage.includes("not the winner");
      
      // Provide user-friendly messages
      if (isOwnershipError) {
        errorMessage = "This NFT is no longer available. The auction may have been cancelled.";
      } else if (isAlreadyClaimedError) {
        errorMessage = "This auction has already been claimed.";
      } else if (isNotEndedError) {
        errorMessage = "The auction hasn't ended yet. Please wait until the auction period is over.";
      } else if (isNotWinnerError) {
        errorMessage = "You are not the winner of this auction.";
      } else if (errorMessage.includes("execution reverted")) {
        // Generic blockchain error - make it more user-friendly
        errorMessage = "Unable to claim NFT. The auction may have already been claimed or there was an issue with the blockchain transaction.";
      }
      
      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const approveAuctionMutation = useMutation({
    mutationFn: async (collectionAddress: string) => {
      const response = await fetch("/api/nft/auction/approve", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nft: collectionAddress })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve for auction");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "NFT approved for auction contract",
      });
    },
    onError: (error: Error) => {
      const isFundingError = error.message.includes("funds") || 
                            error.message.includes("balance") ||
                            error.message.includes("insufficient") ||
                            error.message.includes("Sender doesn't have enough funds");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.message,
        variant: "destructive"
      });
    }
  });

  // Create auction mutation (with approve)
  const createAuctionMutation = useMutation({
    mutationFn: async (data: { nft: string; tokenId: number; startPrice: string; duration: number }) => {
      // Step 1: Approve
      console.log("Step 1: Approving NFT for auction...");
      const approveResponse = await fetch("/api/nft/auction/approve", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nft: data.nft })
      });
      
      if (!approveResponse.ok) {
        const error = await approveResponse.json();
        throw new Error(error.message || "Failed to approve for auction");
      }

      console.log("Step 2: Creating auction...");
      // Step 2: Create auction
      const response = await fetch("/api/nft/auction/create", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create auction");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/auctions"] });
      setShowCreateAuction(false);
      setSelectedCollection("");
      setSelectedNFT(null);
      setAuctionForm({ startPriceETH: "", durationHours: 24 });
      toast({
        title: "Success!",
        description: "Auction created successfully",
      });
    },
    onError: (error: Error) => {
      const isFundingError = error.message.includes("funds") || 
                            error.message.includes("balance") ||
                            error.message.includes("insufficient") ||
                            error.message.includes("Sender doesn't have enough funds");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.message,
        variant: "destructive"
      });
    }
  });

  const formatPrice = (amount: string) => {
    try {
      // Amount is already in ETH (plain number), not wei
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

    return `${hours}h ${minutes}m`;
  };

  if (auctionsLoading) {
    return (
      <TabsContent value="nft-auction">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading auctions..." />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="nft-auction" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">NFT Auctions</h2>
          <p className="text-muted-foreground">Create and manage NFT auctions</p>
        </div>
      </div>

      {/* Collection Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {collections?.map((collection) => (
              <Card 
                key={collection._id} 
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedCollection === collection.contractAddress 
                    ? 'ring-2 ring-primary' 
                    : ''
                }`}
                onClick={() => setSelectedCollection(collection.contractAddress)}
              >
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{collection.name}</h3>
                  <p className="text-sm text-muted-foreground">{collection.symbol}</p>
                  <Badge variant="secondary" className="mt-2">
                    {collection.totalMinted} NFTs
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
          {(!collections || collections.length === 0) && (
            <p className="text-center text-muted-foreground py-8">
              No collections found. Create a collection first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* NFTs Grid */}
      {selectedCollection && (
        <Card>
          <CardHeader>
            <CardTitle>Your NFTs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select any NFT to create an auction. NFTs can be listed for sale AND auctioned simultaneously.
            </p>
          </CardHeader>
          <CardContent>
            {nftsLoading ? (
              <div className="flex justify-center py-8">
                <Loading size="md" text="Loading NFTs..." />
              </div>
            ) : allNFTs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allNFTs.map((nft) => {
                  const imageUrl = nft.imageHash 
                    ? `https://gateway.pinata.cloud/ipfs/${nft.imageHash}`
                    : null;
                  
                  return (
                    <Card key={nft._id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={nft.name || `Token #${nft.tokenId}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Gavel className={`w-8 h-8 text-muted-foreground ${imageUrl ? 'hidden' : ''}`} />
                          {nft.isListed && (
                            <Badge className="absolute top-2 right-2 bg-blue-500">
                              Listed
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{nft.name || `Token #${nft.tokenId}`}</p>
                        <p className="text-xs text-muted-foreground mb-3">Token #{nft.tokenId}</p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedNFT(nft);
                            setShowCreateAuction(true);
                          }}
                        >
                          <Gavel className="w-4 h-4 mr-1" />
                          Create Auction
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No NFTs found in this collection. Mint an NFT first.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Auctions */}
      {activeAuctions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Auctions ({activeAuctions.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Place bids on ongoing auctions. Auctions automatically end when time expires.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAuctions.map((auction) => {
                const timeRemaining = getTimeRemaining(auction.endTime);
                const hasEnded = timeRemaining === "Ended";
                
                return (
                  <Card key={auction._id} className="border-green-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Token #{auction.tokenId}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono">
                            {auction.nftAddress.slice(0, 6)}...{auction.nftAddress.slice(-4)}
                          </p>
                        </div>
                        <Badge variant={hasEnded ? "secondary" : "default"} className={hasEnded ? "" : "bg-green-500"}>
                          <Clock className="w-3 h-3 mr-1" />
                          {hasEnded ? "Ended" : "Active"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
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
                              {auction.highestBidder.slice(0, 6)}...{auction.highestBidder.slice(-4)}
                            </span>
                          </div>
                        )}
                        {hasEnded ? (
                          <Badge variant="secondary" className="w-full justify-center">
                            Auction Ended - Refresh to Claim
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedAuction(auction);
                              setShowBidDialog(true);
                            }}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Place Bid
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ended Auctions */}
      {endedAuctions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ended Auctions ({endedAuctions.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Claim your won auctions
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {endedAuctions.map((auction) => {
                // Convert both to strings for comparison
                const currentUserId = String(auth.user?._id || '');
                const auctionWinnerId = String(auction.highestBidder || '');
                const isWinner = currentUserId && auctionWinnerId && currentUserId === auctionWinnerId;
                                
                return (
                  <Card key={auction._id} className="border-orange-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Token #{auction.tokenId}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono">
                            {auction.nftAddress.slice(0, 6)}...{auction.nftAddress.slice(-4)}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          Ended
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Final Bid:</span>
                          <span className="font-semibold">{formatPrice(auction.currentBid)}</span>
                        </div>
                        {auction.highestBidder !== "0x0000000000000000000000000000000000000000" ? (
                          <div>
                            <div className="flex items-center gap-2 text-sm mb-2">
                              <Trophy className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs">Winner:</span>
                            </div>
                            {auction.winner ? (
                              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                                  {auction.winner.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{auction.winner.name}</p>
                                  <p className="text-xs text-muted-foreground">ID: {auction.highestBidder.slice(0, 8)}...</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs font-mono bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                {auction.highestBidder}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              Your ID: {auth.user?._id}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No bids placed
                          </div>
                        )}
                        {isWinner ? (
                          <Button
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => claimAuctionMutation.mutate(auction.auctionId)}
                            disabled={claimingAuction === auction.auctionId}
                          >
                            {claimingAuction === auction.auctionId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Trophy className="w-4 h-4 mr-1" />
                            Claim NFT
                          </Button>
                        ) : (
                          <Badge variant="outline" className="w-full justify-center py-2">
                            Not Winner
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Place Bid Dialog */}
      <Dialog open={showBidDialog} onOpenChange={(open) => {
        setShowBidDialog(open);
        if (!open) {
          setSelectedAuction(null);
          setBidForm({ amountETH: "" });
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

                <div>
                  <Label>Your Bid (in ETH) *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={parseFloat(selectedAuction.currentBid)}
                    value={bidForm.amountETH}
                    onChange={(e) => setBidForm({ amountETH: e.target.value })}
                    placeholder={(parseFloat(selectedAuction.currentBid) + 0.001).toFixed(3)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be higher than current bid
                  </p>
                </div>

                <Button
                  onClick={() => {
                    if (!bidForm.amountETH || parseFloat(bidForm.amountETH) <= 0) {
                      toast({
                        title: "Error",
                        description: "Please enter a valid bid amount",
                        variant: "destructive"
                      });
                      return;
                    }

                    const currentBidETH = parseFloat(selectedAuction.currentBid);
                    const bidAmountETH = parseFloat(bidForm.amountETH);

                    if (bidAmountETH <= currentBidETH) {
                      toast({
                        title: "Error",
                        description: "Your bid must be higher than the current bid",
                        variant: "destructive"
                      });
                      return;
                    }

                    // Send amount as plain number string (API will handle conversion)
                    const amount = bidForm.amountETH;

                    placeBidMutation.mutate({
                      auctionId: selectedAuction.auctionId,
                      amount: amount
                    });
                  }}
                  disabled={placeBidMutation.isPending}
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

      {/* Create Auction Dialog */}
      <Dialog open={showCreateAuction} onOpenChange={(open) => {
        setShowCreateAuction(open);
        if (!open) {
          setSelectedNFT(null);
          setAuctionForm({ startPriceETH: "", durationHours: 24 });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Auction</DialogTitle>
            {selectedNFT && (
              <p className="text-sm text-muted-foreground">
                {selectedNFT.name || `Token #${selectedNFT.tokenId}`}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This will approve the auction contract and create an auction for your NFT.
              </p>
              {selectedNFT?.isListed && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  ℹ️ This NFT is also listed for sale. Whichever sells first (auction or fixed price) will complete the sale.
                </p>
              )}
            </div>

            <div>
              <Label>Starting Price (in ETH) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={auctionForm.startPriceETH}
                onChange={(e) => setAuctionForm({ ...auctionForm, startPriceETH: e.target.value })}
                placeholder="0.1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum bid amount in ETH
              </p>
            </div>

            <div>
              <Label>Duration *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    value={auctionForm.durationHours}
                    onChange={(e) => setAuctionForm({ ...auctionForm, durationHours: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Hours (24 = 1 day)
                  </p>
                </div>
                <div className="flex items-center text-muted-foreground">or</div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Minutes"
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0;
                      setAuctionForm({ ...auctionForm, durationHours: minutes / 60 });
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minutes (for testing)
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                if (!selectedNFT) {
                  toast({
                    title: "Error",
                    description: "Please select an NFT to auction",
                    variant: "destructive"
                  });
                  return;
                }

                if (!auctionForm.startPriceETH || parseFloat(auctionForm.startPriceETH) <= 0) {
                  toast({
                    title: "Error",
                    description: "Please enter a valid starting price",
                    variant: "destructive"
                  });
                  return;
                }

                // Send price as plain number string (API will handle conversion)
                const startPrice = auctionForm.startPriceETH;
                const durationSeconds = auctionForm.durationHours * 3600;

                createAuctionMutation.mutate({
                  nft: selectedCollection,
                  tokenId: selectedNFT.tokenId,
                  startPrice: startPrice,
                  duration: durationSeconds
                });
              }}
              disabled={!selectedNFT || createAuctionMutation.isPending}
              className="w-full"
            >
              {createAuctionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {createAuctionMutation.isPending ? "Approving & Creating..." : "Create Auction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
