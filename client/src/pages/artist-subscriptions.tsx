import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Crown, Users, Heart, Loader2, Search, CheckCircle, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getAuthHeaders } from "@/lib/auth";

interface ArtistToken {
  _id: string;
  artistId: string;
  artistWalletAddress: string; // Artist's personal wallet address
  tokenAddress: string; // Token contract address
  tokenName: string;
  tokenSymbol: string;
  totalSubscribers: number;
  createdAt: string;
  artist?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface Subscription {
  _id: string;
  artistId: string;
  subscriberId: string;
  artistWallet: string;
  subscribedAt: string;
  artist?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  artistToken?: ArtistToken;
}

export default function ArtistSubscriptionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [subscribingToArtist, setSubscribingToArtist] = useState<string | null>(null); // Track which artist is being subscribed to

  // Fetch all artist tokens (public)
  const { data: tokensData, isLoading: tokensLoading } = useQuery<{ tokens: ArtistToken[] }>({
    queryKey: ["/api/public/artist-tokens"],
    queryFn: async () => {
      const response = await fetch("/api/public/artist-tokens");
      if (!response.ok) throw new Error("Failed to fetch artist tokens");
      return response.json();
    },
  });

  // Fetch my subscriptions (requires auth)
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ["/api/nft/artist/my-subscriptions"],
    queryFn: async () => {
      const response = await fetch("/api/nft/artist/my-subscriptions", {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch subscriptions");
      return response.json();
    },
    enabled: !!user,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (artistWallet: string) => {
      setSubscribingToArtist(artistWallet); // Set which artist is being subscribed to
      const response = await fetch("/api/nft/artist/subscribe", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ artistWallet })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to subscribe");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/artist/my-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/artist-tokens"] });
      setSubscribingToArtist(null); // Clear the subscribing state
      toast({
        title: "Success!",
        description: "You've successfully subscribed to this artist",
      });
    },
    onError: (error: Error) => {
      setSubscribingToArtist(null); // Clear the subscribing state on error
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

  const artistTokens = tokensData?.tokens || [];
  const mySubscriptions = subscriptionsData?.subscriptions || [];
  const subscribedArtistIds = new Set(mySubscriptions.map(sub => sub.artistId));

  // Filter artists based on search and exclude current user's own token
  const filteredArtists = artistTokens.filter(token => {
    // Don't show user's own token
    if (user && token.artistId === user._id) {
      return false;
    }
    
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      token.tokenName.toLowerCase().includes(searchLower) ||
      token.tokenSymbol.toLowerCase().includes(searchLower) ||
      token.artist?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({
      title: "Copied!",
      description: "Token address copied to clipboard",
    });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSubscribe = (artistWallet: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to subscribe to artists",
        variant: "destructive"
      });
      return;
    }
    subscribeMutation.mutate(artistWallet);
  };

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Artist Subscriptions</h1>
          <p className="text-muted-foreground">
            Subscribe to your favorite artists and support their work
          </p>
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse">Browse Artists</TabsTrigger>
            {user && <TabsTrigger value="my-subscriptions">My Subscriptions</TabsTrigger>}
          </TabsList>

          {/* Browse Artists Tab */}
          <TabsContent value="browse" className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search artists by name, token name, or symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Artists Grid */}
            {tokensLoading ? (
              <div className="flex justify-center py-12">
                <Loading size="lg" text="Loading artists..." />
              </div>
            ) : filteredArtists.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArtists.map((token) => {
                  const isSubscribed = subscribedArtistIds.has(token.artistId);
                  
                  return (
                    <Card key={token._id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-lg">
                              {token.artist?.name?.charAt(0).toUpperCase() || token.tokenSymbol.charAt(0)}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{token.artist?.name || "Unknown Artist"}</CardTitle>
                              <p className="text-sm text-muted-foreground">{token.tokenName}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            {token.tokenSymbol}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subscribers</span>
                          <span className="font-semibold flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {token.totalSubscribers}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Artist Wallet Address</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyAddress(token.artistWalletAddress)}
                              className="h-6 px-2"
                            >
                              {copiedAddress === token.artistWalletAddress ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                            {token.artistWalletAddress}
                          </p>
                        </div>

                        {isSubscribed ? (
                          <Button disabled className="w-full" variant="secondary">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Subscribed
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSubscribe(token.artistWalletAddress)}
                            disabled={subscribingToArtist === token.artistWalletAddress}
                            className="w-full gradient-primary"
                          >
                            {subscribingToArtist === token.artistWalletAddress ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Subscribing...
                              </>
                            ) : (
                              <>
                                <Heart className="w-4 h-4 mr-2" />
                                Subscribe
                              </>
                            )}
                          </Button>
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
                    <Crown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery ? "No artists found" : "No artists available"}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? "Try adjusting your search query"
                        : "Artists haven't created subscription tokens yet"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Subscriptions Tab */}
          {user && (
            <TabsContent value="my-subscriptions" className="space-y-6">
              {subscriptionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loading size="lg" text="Loading your subscriptions..." />
                </div>
              ) : mySubscriptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mySubscriptions.map((sub) => (
                    <Card key={sub._id}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-lg">
                            {sub.artist?.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{sub.artist?.name || "Unknown Artist"}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {sub.artistToken?.tokenName || "Artist Token"}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Token Symbol</span>
                          <Badge variant="secondary">
                            {sub.artistToken?.tokenSymbol || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subscribed</span>
                          <span className="font-medium">
                            {new Date(sub.subscribedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge className="w-full justify-center bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active Subscription
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No subscriptions yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start supporting your favorite artists by subscribing to them
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
