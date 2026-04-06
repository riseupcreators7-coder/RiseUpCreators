import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Package, Gavel, Eye, TrendingUp } from "lucide-react";
import Loading from "@/components/common/loading";

export default function AdminNFTManagement() {
  const [selectedView, setSelectedView] = useState<"collections" | "auctions">("collections");

  // Fetch all NFT collections
  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ["/api/admin/nft/collections"],
    queryFn: async () => {
      const response = await fetch("/api/admin/nft/collections", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch collections");
      return response.json();
    }
  });

  // Fetch all auctions
  const { data: auctionsData, isLoading: auctionsLoading } = useQuery({
    queryKey: ["/api/admin/nft/auctions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/nft/auctions", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch auctions");
      return response.json();
    }
  });

  const formatPrice = (wei: string) => {
    try {
      const eth = parseFloat(wei) / 1e18;
      return `${eth.toFixed(4)} ETH`;
    } catch {
      return "0 ETH";
    }
  };

  if (collectionsLoading || auctionsLoading) {
    return <Loading size="lg" text="Loading NFT data..." />;
  }

  const collections = collectionsData?.collections || [];
  const auctions = auctionsData?.auctions || [];

  const totalCollections = collections.length;
  const totalMinted = collections.reduce((sum: number, c: any) => sum + c.totalMinted, 0);
  const activeAuctions = auctions.filter((a: any) => a.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Collections</p>
                <p className="text-2xl font-bold">{totalCollections}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total NFTs Minted</p>
                <p className="text-2xl font-bold">{totalMinted}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Auctions</p>
                <p className="text-2xl font-bold">{activeAuctions}</p>
              </div>
              <Gavel className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Auctions</p>
                <p className="text-2xl font-bold">{auctions.length}</p>
              </div>
              <Eye className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={selectedView === "collections" ? "default" : "outline"}
          onClick={() => setSelectedView("collections")}
        >
          <Package className="w-4 h-4 mr-2" />
          Collections
        </Button>
        <Button
          variant={selectedView === "auctions" ? "default" : "outline"}
          onClick={() => setSelectedView("auctions")}
        >
          <Gavel className="w-4 h-4 mr-2" />
          Auctions
        </Button>
      </div>

      {/* Collections View */}
      {selectedView === "collections" && (
        <Card>
          <CardHeader>
            <CardTitle>NFT Collections</CardTitle>
          </CardHeader>
          <CardContent>
            {collections.length > 0 ? (
              <div className="space-y-4">
                {collections.map((collection: any) => (
                  <div key={collection._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{collection.name}</h3>
                        <Badge variant="secondary">{collection.symbol}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {collection.contractAddress}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>Minted: {collection.totalMinted}/{collection.maxSupply}</span>
                        <span>Royalty: {collection.royaltyBps / 100}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(collection.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No collections found</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auctions View */}
      {selectedView === "auctions" && (
        <Card>
          <CardHeader>
            <CardTitle>NFT Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            {auctions.length > 0 ? (
              <div className="space-y-4">
                {auctions.map((auction: any) => (
                  <div key={auction._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">Token #{auction.tokenId}</h3>
                        <Badge variant={auction.status === "active" ? "default" : "secondary"}>
                          {auction.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono mb-2">
                        {auction.nftAddress}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span>Start: {formatPrice(auction.startPrice)}</span>
                        <span className="text-green-600">Current: {formatPrice(auction.currentBid)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Ends: {new Date(auction.endTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No auctions found</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
