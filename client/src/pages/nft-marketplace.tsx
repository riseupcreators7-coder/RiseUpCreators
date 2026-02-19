import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Search, Filter, ShoppingCart, Loader2, Image as ImageIcon, Gavel, Clock, Trophy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getAuthHeaders } from "@/lib/auth";
import Loading from "@/components/common/loading";

export default function NFTMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [buyingNFT, setBuyingNFT] = useState<string | null>(null); // Track which NFT is being bought
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buy NFT mutation
  const buyNFTMutation = useMutation({
    mutationFn: async ({ nft, tokenId, price }: { nft: string; tokenId: number; price: string }) => {
      setBuyingNFT(`${nft}-${tokenId}`); // Set the specific NFT being bought
      const response = await fetch("/api/nft/buy", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nft, tokenId, price })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to buy NFT");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/nfts"] });
      setBuyingNFT(null); // Clear the buying state
      toast({
        title: "Success!",
        description: "NFT purchased successfully",
      });
    },
    onError: (error: Error) => {
      setBuyingNFT(null); // Clear the buying state on error
      
      // Extract and format error message
      let errorMessage = error.message || "Failed to buy NFT";
      
      // Check for common error patterns
      const isOwnershipError = errorMessage.includes("not token owner") || 
                              errorMessage.includes("caller is not token owner");
      
      const isApprovalError = errorMessage.includes("not approved") || 
                             errorMessage.includes("ERC721: caller is not token owner or approved");
      
      const isFundingError = errorMessage.includes("funds") || 
                            errorMessage.includes("balance") ||
                            errorMessage.includes("insufficient");
      
      const isAlreadySoldError = errorMessage.includes("already sold") ||
                                errorMessage.includes("not listed");
      
      // Provide user-friendly messages
      if (isOwnershipError || isApprovalError) {
        errorMessage = "This NFT is no longer available for sale. The seller may have removed it from the marketplace.";
      } else if (isFundingError) {
        errorMessage = "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet.";
      } else if (isAlreadySoldError) {
        errorMessage = "This NFT has already been sold to another buyer.";
      } else if (errorMessage.includes("execution reverted")) {
        // Generic blockchain error - make it more user-friendly
        errorMessage = "Transaction failed. This NFT may no longer be available or there was an issue with the blockchain transaction.";
      }
      
      toast({
        title: "Purchase Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
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

  // Fetch all listed NFTs
  const { data: marketplaceData, isLoading } = useQuery({
    queryKey: ["/api/marketplace/nfts"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/nfts");
      if (!response.ok) throw new Error("Failed to fetch marketplace");
      return response.json();
    }
  });

  // Fetch all auctions
  const { data: auctionsData, isLoading: auctionsLoading } = useQuery({
    queryKey: ["/api/marketplace/auctions"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/auctions");
      if (!response.ok) throw new Error("Failed to fetch auctions");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatPrice = (amount: string) => {
    try {
      const num = parseFloat(amount);
      // If the number is very large (> 1000), it's likely in wei format (old data), convert it
      if (num > 1000) {
        const eth = num / 1e18;
        return `${eth.toFixed(4)} ETH`;
      }
      // Otherwise it's already in ETH (new format)
      return `${num.toFixed(4)} ETH`;
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

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Loading size="lg" text="Loading NFT marketplace..." />
        </div>
      </div>
    );
  }

  const collections = marketplaceData?.collections || [];
  const listedNFTs = marketplaceData?.nfts || [];

  // Filter NFTs by collection and search query
  const filteredNFTs = listedNFTs.filter((nft: any) => {
    if (!nft) return false;
    
    // Filter by collection
    if (selectedCollection && nft.collectionId !== selectedCollection) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const tokenIdMatch = nft.tokenId?.toString().includes(searchLower);
      const collectionMatch = nft.collectionId?.toLowerCase().includes(searchLower);
      
      // Find collection name
      const collection = collections.find((c: any) => c.contractAddress === nft.collectionId);
      const collectionNameMatch = collection?.name?.toLowerCase().includes(searchLower);
      
      return tokenIdMatch || collectionMatch || collectionNameMatch;
    }
    
    return true;
  });

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">NFT Marketplace</h1>
          <p className="text-muted-foreground">
            Discover and collect unique digital assets from your favorite artists
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search NFTs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Collections */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Collections</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Button
              variant={selectedCollection === null ? "default" : "outline"}
              onClick={() => setSelectedCollection(null)}
              className="h-auto py-4"
            >
              All
            </Button>
            {collections.map((collection: any) => (
              <Button
                key={collection._id}
                variant={selectedCollection === collection.contractAddress ? "default" : "outline"}
                onClick={() => setSelectedCollection(collection.contractAddress)}
                className="h-auto py-4 flex flex-col items-start"
              >
                <span className="font-semibold">{collection.name}</span>
                <span className="text-xs text-muted-foreground">
                  {collection.totalMinted} items
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* NFT Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4">
            {selectedCollection ? "Collection NFTs" : "All NFTs"}
          </h2>
          {filteredNFTs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredNFTs.map((nft: any) => {
                const imageUrl = nft.imageHash 
                  ? `https://gateway.pinata.cloud/ipfs/${nft.imageHash}`
                  : null;
                
                return (
                  <Card key={nft._id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={`Token #${nft.tokenId}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <ImageIcon className={`w-16 h-16 text-muted-foreground ${imageUrl ? 'hidden' : ''}`} />
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold mb-2">Token #{nft.tokenId}</h3>
                        {nft.collectionId && (
                          <p className="text-xs text-muted-foreground mb-3 font-mono">
                            {nft.collectionId.slice(0, 6)}...{nft.collectionId.slice(-4)}
                          </p>
                        )}
                        {nft.price && (
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Price</span>
                            <span className="font-bold text-green-600">
                              {formatPrice(nft.price)}
                            </span>
                          </div>
                        )}
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            // Validate tokenId is a number
                            const tokenId = typeof nft.tokenId === 'string' 
                              ? parseInt(nft.tokenId) 
                              : nft.tokenId;

                            if (isNaN(tokenId)) {
                              toast({
                                title: "Invalid NFT",
                                description: "This NFT has an invalid token ID and cannot be purchased",
                                variant: "destructive"
                              });
                              return;
                            }

                            if (!user) {
                              toast({
                                title: "Sign in required",
                                description: "Please sign in to buy NFTs",
                                variant: "destructive"
                              });
                              return;
                            }

                            // Price should be sent as-is (in the same format it was stored)
                            let priceStr = nft.price;
                            if (typeof nft.price === 'number') {
                              priceStr = nft.price.toString();
                            }

                            console.log("🛒 Buying NFT:", {
                              nft: nft.collectionId,
                              tokenId: tokenId,
                              price: priceStr
                            });

                            buyNFTMutation.mutate({
                              nft: nft.collectionId,
                              tokenId: tokenId,
                              price: priceStr
                            });
                          }}
                          disabled={buyingNFT === `${nft.collectionId}-${nft.tokenId}` || !user}
                        >
                          {buyingNFT === `${nft.collectionId}-${nft.tokenId}` && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {user ? "Buy Now" : "Sign In to Buy"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No NFTs Listed</h3>
                  <p className="text-muted-foreground">
                    Check back soon for new listings
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
