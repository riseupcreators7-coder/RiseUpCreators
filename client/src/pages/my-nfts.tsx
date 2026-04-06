import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Package, Image as ImageIcon, Info } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import Loading from "@/components/common/loading";

interface NFT {
  _id: string;
  collectionId: string;
  tokenId: number;
  owner: string;
  tokenURI: string;
  ipfsHash: string;
  imageHash: string;
  name: string;
  description: string;
  isListed: boolean;
  price?: string;
  transactionHash: string;
  createdAt: string;
  collection?: {
    name: string;
    symbol: string;
    contractAddress: string;
  };
}

export default function MyNFTsPage() {
  const { user } = useAuth();
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  // Fetch user's NFTs
  const { data: nftsData, isLoading } = useQuery<{ nfts: NFT[] }>({
    queryKey: ["/api/nft/my-nfts"],
    queryFn: async () => {
      const response = await fetch("/api/nft/my-nfts", {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch NFTs");
      return response.json();
    },
    enabled: !!user,
  });

  const nfts = nftsData?.nfts || [];

  if (!user) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sign in required</h3>
                <p className="text-muted-foreground">
                  Please sign in to view your NFT collection
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Loading size="lg" text="Loading your NFTs..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My NFT Collection</h1>
          <p className="text-muted-foreground">
            View and manage your digital assets
          </p>
        </div>

        {/* NFTs Grid */}
        {nfts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <Card key={nft._id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-muted">
                  {nft.imageHash ? (
                    <img
                      src={`https://gateway.pinata.cloud/ipfs/${nft.imageHash}`}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className="hidden absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                  {nft.isListed && (
                    <Badge className="absolute top-2 right-2 bg-green-600">
                      Listed for Sale
                    </Badge>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{nft.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {nft.collection?.name || "Unknown Collection"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {nft.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token ID</span>
                    <span className="font-semibold">#{nft.tokenId}</span>
                  </div>

                  {nft.isListed && nft.price && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-semibold">
                        {(parseInt(nft.price) / 1e18).toFixed(4)} ETH
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedNFT(nft);
                        setShowMetadata(true);
                      }}
                    >
                      <Info className="w-4 h-4 mr-2" />
                      View Metadata
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Purchased {new Date(nft.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No NFTs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start collecting unique digital assets from your favorite artists
                </p>
                <a href="/nft-marketplace" className="text-primary hover:underline">
                  Browse NFT Marketplace →
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata Dialog */}
        <Dialog open={showMetadata} onOpenChange={setShowMetadata}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>NFT Metadata</DialogTitle>
            </DialogHeader>
            {selectedNFT && (
              <div className="space-y-4">
                <div className="aspect-square w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
                  {selectedNFT.imageHash ? (
                    <img
                      src={`https://gateway.pinata.cloud/ipfs/${selectedNFT.imageHash}`}
                      alt={selectedNFT.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Name</h3>
                    <p className="text-base">{selectedNFT.name}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
                    <p className="text-base">{selectedNFT.description}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Token ID</h3>
                    <p className="text-base font-mono">#{selectedNFT.tokenId}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Collection</h3>
                    <p className="text-base">{selectedNFT.collection?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {selectedNFT.collectionId}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">IPFS Hash</h3>
                    <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                      {selectedNFT.ipfsHash}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Image Hash</h3>
                    <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                      {selectedNFT.imageHash}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Transaction Hash</h3>
                    <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                      {selectedNFT.transactionHash}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Purchased Date</h3>
                    <p className="text-base">
                      {new Date(selectedNFT.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
