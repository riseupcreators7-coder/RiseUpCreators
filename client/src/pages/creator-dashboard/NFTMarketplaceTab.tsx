import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { Package, Plus, Edit, Trash2, Eye, DollarSign, Image as ImageIcon, Loader2, Wallet, AlertCircle, Copy, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getCreatorAuthHeaders } from "./utils";

interface NFTCollection {
  _id: string;
  artistId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  maxSupply: number;
  royaltyBps: number;
  totalMinted: number;
  createdAt: string;
}

interface NFT {
  _id: string;
  collectionId: string;
  tokenId: number;
  owner: string;
  tokenURI: string;
  ipfsHash: string;
  imageHash: string;
  nftType: number;
  price?: string;
  isListed: boolean;
  createdAt: string;
}

export default function NFTMarketplaceTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showMintNFT, setShowMintNFT] = useState(false);
  const [showListDialog, setShowListDialog] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Fetch wallet address
  const { data: walletData } = useQuery<{ walletAddress: string }>({
    queryKey: ["/api/nft/wallet-address"],
    queryFn: async () => {
      const response = await fetch("/api/nft/wallet-address", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch wallet address");
      const data = await response.json();
      return data;
    },
    enabled: !!auth.user,
  });

  const walletAddress = walletData?.walletAddress;

  // Copy wallet address to clipboard
  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Form states
  const [collectionForm, setCollectionForm] = useState({
    name: "",
    symbol: "",
    maxSupply: 100,
    royaltyBps: 500
  });

  const [nftForm, setNftForm] = useState({
    collectionAddress: "",
    collectionName: "",
    name: "",
    description: "",
    image: null as File | null,
    listNow: false,
    price: ""
  });

  const [listingForm, setListingForm] = useState({
    collectionAddress: "",
    tokenId: 0,
    price: ""
  });

  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  // Fetch collections
  const { data: collections, isLoading: collectionsLoading } = useQuery<NFTCollection[]>({
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
      const response = await fetch(`/api/nft/nfts/${selectedCollection}`, {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch NFTs");
      const data = await response.json();
      return data.nfts || [];
    },
    enabled: !!auth.user && !!selectedCollection,
  });

  // Create collection mutation
  const createCollectionMutation = useMutation({
    mutationFn: async (data: typeof collectionForm) => {
      const response = await fetch("/api/nft/create-collection", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create collection");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/collections"] });
      setShowCreateCollection(false);
      setCollectionForm({ name: "", symbol: "", maxSupply: 100, royaltyBps: 500 });
      toast({
        title: "Success!",
        description: "NFT collection created successfully",
      });
    },
    onError: (error: Error) => {
      // Check if it's a funding issue
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

  // Mint NFT mutation
  const mintNFTMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/nft/mint-with-upload", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
        },
        body: data
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mint NFT");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/nfts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nft/collections"] });
      setShowMintNFT(false);
      setNftForm({ collectionAddress: "", collectionName: "", name: "", description: "", image: null, listNow: false, price: "" });
      toast({
        title: "Success!",
        description: "NFT minted successfully to your wallet",
      });
    },
    onError: (error: Error) => {
      // Check if it's a funding issue
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

  // Approve and List NFT mutation (combined flow)
  const approveAndListMutation = useMutation({
    mutationFn: async (data: { nft: string; tokenId: number; price: string }) => {
      // Step 1: Approve collection for marketplace
      console.log("📝 Step 1: Approving collection for marketplace...");
      const approveResponse = await fetch("/api/nft/approve", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nft: data.nft })
      });
      
      if (!approveResponse.ok) {
        const error = await approveResponse.json();
        throw new Error(error.message || "Failed to approve collection");
      }

      console.log("✅ Collection approved!");
      console.log("📝 Step 2: Listing NFT for sale...");

      // Step 2: List NFT for sale
      const listResponse = await fetch("/api/nft/list", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if (!listResponse.ok) {
        const error = await listResponse.json();
        throw new Error(error.message || "Failed to list NFT");
      }

      return listResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/nfts"] });
      setShowListDialog(false);
      setSelectedNFT(null);
      setListingForm({ collectionAddress: "", tokenId: 0, price: "" });
      toast({
        title: "Success!",
        description: "NFT approved and listed for sale",
      });
    },
    onError: (error: any) => {
      // Extract the actual error message
      let errorMessage = "Failed to list NFT";
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Check if it's a funding issue
      const isFundingError = errorMessage.includes("funds") || 
                            errorMessage.includes("balance") ||
                            errorMessage.includes("insufficient") ||
                            errorMessage.includes("Sender doesn't have enough funds");
      
      // Check if it's an ownership issue
      const isOwnershipError = errorMessage.includes("Not owner") || 
                              errorMessage.includes("not owner") ||
                              errorMessage.includes("ownership");
      
      toast({
        title: "Error",
        description: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : isOwnershipError
          ? "You don't own this NFT. Only the NFT owner can list it for sale."
          : errorMessage,
        variant: "destructive"
      });
    }
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

  if (collectionsLoading) {
    return (
      <TabsContent value="nft-marketplace">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading NFT marketplace..." />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="nft-marketplace" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">NFT Marketplace</h2>
            <p className="text-muted-foreground">Create and manage your NFT collections</p>
          </div>
          <Dialog open={showCreateCollection} onOpenChange={setShowCreateCollection}>
            <DialogTrigger asChild>
              <Button className="gradient-primary" disabled={!walletAddress}>
                <Plus className="w-4 h-4 mr-2" />
                Create Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create NFT Collection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Collection Name</Label>
                  <Input
                    value={collectionForm.name}
                    onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
                    placeholder="My NFT Collection"
                  />
                </div>
                <div>
                  <Label>Symbol</Label>
                  <Input
                    value={collectionForm.symbol}
                    onChange={(e) => setCollectionForm({ ...collectionForm, symbol: e.target.value })}
                    placeholder="MNFT"
                  />
                </div>
                <div>
                  <Label>Max Supply</Label>
                  <Input
                    type="number"
                    value={collectionForm.maxSupply}
                    onChange={(e) => setCollectionForm({ ...collectionForm, maxSupply: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Royalty (basis points, 500 = 5%)</Label>
                  <Input
                    type="number"
                    value={collectionForm.royaltyBps}
                    onChange={(e) => setCollectionForm({ ...collectionForm, royaltyBps: parseInt(e.target.value) })}
                  />
                </div>
                <Button
                  onClick={() => createCollectionMutation.mutate(collectionForm)}
                  disabled={createCollectionMutation.isPending}
                  className="w-full"
                >
                  {createCollectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Collection
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Wallet Address Card */}
      {walletAddress ? (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Your Wallet Address</h3>
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-sm font-mono bg-white dark:bg-gray-900 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100">
                    {walletAddress}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={copyWalletAddress}
                  >
                    {copiedAddress ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Send this address to support for manual funding before creating collections
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 mt-1" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Wallet Setup Required</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please log in again to sync your wallet address from the NFT marketplace
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collections Grid */}
      {collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card key={collection._id} className={`hover:shadow-lg transition-shadow ${!collection.contractAddress ? 'border-red-500 opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{collection.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{collection.symbol}</p>
                  </div>
                  <Badge variant="secondary">
                    <Package className="w-3 h-3 mr-1" />
                    {collection.totalMinted}/{collection.maxSupply}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Royalty:</span>
                    <span>{collection.royaltyBps / 100}%</span>
                  </div>
                  {collection.contractAddress ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contract:</span>
                      <span className="font-mono text-xs">{collection.contractAddress.slice(0, 6)}...{collection.contractAddress.slice(-4)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-red-500 font-medium">
                      ⚠️ Invalid collection - please create a new one
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (!collection.contractAddress) {
                        toast({
                          title: "Error",
                          description: "This collection doesn't have a valid contract address. Please create a new collection.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setSelectedCollection(collection.contractAddress);
                      setNftForm({ 
                        collectionAddress: collection.contractAddress,
                        collectionName: collection.name,
                        name: "",
                        description: "",
                        image: null,
                        listNow: false,
                        price: ""
                      });
                      setShowMintNFT(true);
                    }}
                    disabled={!collection.contractAddress}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Mint NFT
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCollection(collection.contractAddress)}
                    disabled={!collection.contractAddress}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Collections Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first NFT collection to start minting
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mint NFT Dialog */}
      <Dialog open={showMintNFT} onOpenChange={setShowMintNFT}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mint NFT</DialogTitle>
            {nftForm.collectionName && (
              <p className="text-sm text-muted-foreground">
                Collection: <span className="font-semibold">{nftForm.collectionName}</span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {/* Wallet Info */}
            {walletAddress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Your Wallet Address
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 font-mono">
                      {walletAddress}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      NFT will be minted to this address
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>NFT Name *</Label>
              <Input
                value={nftForm.name}
                onChange={(e) => setNftForm({ ...nftForm, name: e.target.value })}
                placeholder="My Awesome NFT"
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={nftForm.description}
                onChange={(e) => setNftForm({ ...nftForm, description: e.target.value })}
                placeholder="Describe your NFT..."
                rows={3}
              />
            </div>
            <div>
              <Label>NFT Image * (Max 10MB)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast({
                        title: "Error",
                        description: "Image must be less than 10MB",
                        variant: "destructive"
                      });
                      return;
                    }
                    setNftForm({ ...nftForm, image: file });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Upload your NFT artwork (JPG, PNG, GIF)
              </p>
            </div>
            
            {/* List Now Option - Disabled for now */}
            {/* Note: Listing requires the NFT owner (user) to approve and sign the transaction.
                Since the NFT is minted to the user's wallet, the backend cannot list it.
                Users should mint first, then manually list through the marketplace. */}
            {false && (
              <>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <input
                    type="checkbox"
                    id="listNow"
                    checked={nftForm.listNow}
                    onChange={(e) => setNftForm({ ...nftForm, listNow: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="listNow" className="cursor-pointer">
                    List for sale immediately after minting
                  </Label>
                </div>

                {/* Price Field (only show if listNow is checked) */}
                {nftForm.listNow && (
                  <div>
                    <Label>Price (in ETH) *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={nftForm.price}
                      onChange={(e) => setNftForm({ ...nftForm, price: e.target.value })}
                      placeholder="0.1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set the listing price in ETH (e.g., 0.1 ETH)
                    </p>
                  </div>
                )}
              </>
            )}
            
            <Button
              onClick={() => {
                if (!walletAddress) {
                  toast({
                    title: "Wallet Required",
                    description: "Please log in again to sync your wallet address",
                    variant: "destructive"
                  });
                  return;
                }

                if (!nftForm.name || !nftForm.description || !nftForm.image) {
                  toast({
                    title: "Error",
                    description: "Please fill in all required fields",
                    variant: "destructive"
                  });
                  return;
                }

                // Validate price if listing now
                if (nftForm.listNow && (!nftForm.price || parseFloat(nftForm.price) <= 0)) {
                  toast({
                    title: "Invalid Price",
                    description: "Please enter a valid price greater than 0",
                    variant: "destructive"
                  });
                  return;
                }
                
                const formData = new FormData();
                formData.append("collectionAddress", nftForm.collectionAddress);
                formData.append("name", nftForm.name);
                formData.append("description", nftForm.description);
                formData.append("image", nftForm.image);
                formData.append("listNow", nftForm.listNow.toString());
                formData.append("price", nftForm.price);
                
                mintNFTMutation.mutate(formData);
              }}
              disabled={!walletAddress || mintNFTMutation.isPending}
              className="w-full"
            >
              {mintNFTMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {!walletAddress ? "Wallet Required" : mintNFTMutation.isPending ? "Uploading & Minting..." : "Mint NFT"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Your image will be uploaded to IPFS automatically
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* List NFT Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List NFT for Sale</DialogTitle>
            {selectedNFT && (
              <p className="text-sm text-muted-foreground">
                Token #{selectedNFT.tokenId}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This will approve the marketplace contract and list your NFT for sale in one transaction.
              </p>
            </div>
            
            <div>
              <Label>Price (in ETH) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={listingForm.price}
                onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}
                placeholder="0.1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set the listing price in ETH (e.g., 0.1 ETH)
              </p>
            </div>

            <Button
              onClick={() => {
                if (!listingForm.price || parseFloat(listingForm.price) <= 0) {
                  toast({
                    title: "Invalid Price",
                    description: "Please enter a valid price greater than 0",
                    variant: "destructive"
                  });
                  return;
                }

                // Send price as plain ETH value (API will handle conversion if needed)
                approveAndListMutation.mutate({
                  nft: listingForm.collectionAddress,
                  tokenId: listingForm.tokenId,
                  price: listingForm.price
                });
              }}
              disabled={approveAndListMutation.isPending}
              className="w-full"
            >
              {approveAndListMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {approveAndListMutation.isPending ? "Approving & Listing..." : "Approve & List NFT"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List NFT Dialog - Disabled: Backend cannot list user-owned NFTs */}
      {/* To enable listing, implement Web3 frontend integration where users sign transactions */}

      {/* NFTs for Selected Collection */}
      {selectedCollection && (
        <Card>
          <CardHeader>
            <CardTitle>NFTs in Collection</CardTitle>
          </CardHeader>
          <CardContent>
            {nftsLoading ? (
              <div className="flex justify-center py-8">
                <Loading size="md" text="Loading NFTs..." />
              </div>
            ) : nfts && nfts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {nfts.map((nft) => {
                  const imageUrl = nft.imageHash 
                    ? `https://gateway.pinata.cloud/ipfs/${nft.imageHash}`
                    : null;
                  
                  return (
                    <Card key={nft._id}>
                      <CardContent className="p-4">
                        <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={`Token #${nft.tokenId}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <ImageIcon className={`w-8 h-8 text-muted-foreground ${imageUrl ? 'hidden' : ''}`} />
                        </div>
                        <p className="text-sm font-medium">Token #{nft.tokenId}</p>
                        <p className="text-xs text-muted-foreground mb-2">{nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}</p>
                        {nft.isListed && nft.price && (
                          <Badge variant="secondary" className="text-xs mb-2">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatPrice(nft.price)}
                          </Badge>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 mt-2">
                          {!nft.isListed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setSelectedNFT(nft);
                                setListingForm({
                                  collectionAddress: nft.collectionId,
                                  tokenId: nft.tokenId,
                                  price: ""
                                });
                                setShowListDialog(true);
                              }}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              List for Sale
                            </Button>
                          ) : (
                            <Badge variant="default" className="w-full justify-center">
                              Listed for Sale
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No NFTs minted yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
