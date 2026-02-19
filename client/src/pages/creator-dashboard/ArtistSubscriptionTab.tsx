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
import { Crown, Plus, Users, Heart, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { getCreatorAuthHeaders } from "./utils";

interface ArtistToken {
  _id: string;
  artistId: string;
  artistWalletAddress: string; // Artist's personal wallet address
  tokenAddress: string; // Token contract address
  tokenName: string;
  tokenSymbol: string;
  totalSubscribers: number;
  createdAt: string;
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

interface Subscriber {
  username?: string;
  wallet?: string;
  subscribedAt: string;
  subscriber?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}


export default function ArtistSubscriptionTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [showCreateToken, setShowCreateToken] = useState(false);

  const [tokenForm, setTokenForm] = useState({
    tokenName: "",
    tokenSymbol: ""
  });

  // Fetch artist token
  const { data: tokenData, isLoading: tokenLoading } = useQuery<{ token: ArtistToken }>({
    queryKey: ["/api/nft/artist/token"],
    queryFn: async () => {
      const response = await fetch("/api/nft/artist/token", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) return { token: null };
        throw new Error("Failed to fetch token");
      }
      return response.json();
    },
    enabled: !!auth.user,
    retry: false, // Don't retry 404s
  });

  // Fetch my subscribers - always fetch even if no token in DB
  const { data: subscribersData, isLoading: subscribersLoading } = useQuery<{ subscribers: Subscriber[] }>({
    queryKey: ["/api/nft/artist/my-subscribers"],
    queryFn: async () => {
      const response = await fetch("/api/nft/artist/my-subscribers", {
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch subscribers");
      return response.json();
    },
    enabled: !!auth.user, // Always enabled, not dependent on token
  });

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: async (data: typeof tokenForm) => {
      const response = await fetch("/api/nft/artist/create-token", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create token");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nft/artist/token"] });
      setShowCreateToken(false);
      setTokenForm({ tokenName: "", tokenSymbol: "" });
      toast({
        title: "Success!",
        description: "Artist subscription token created successfully",
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

  const artistToken = tokenData?.token;
  const subscribers = subscribersData?.subscribers || [];

  if (tokenLoading) {
    return (
      <TabsContent value="artist-subscription">
        <div className="flex justify-center items-center py-12">
          <Loading size="lg" text="Loading subscription info..." />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="artist-subscription" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Artist Subscriptions</h2>
          <p className="text-muted-foreground">Manage your subscription token and subscribers</p>
        </div>
      </div>

      {/* Artist Token Card */}
      {artistToken ? (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-purple-600" />
                  Your Subscription Token
                </CardTitle>
              </div>
              <Badge className="bg-purple-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Token Name</p>
                  <p className="font-semibold">{artistToken.tokenName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Token Symbol</p>
                  <p className="font-semibold">{artistToken.tokenSymbol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Subscribers</p>
                  <p className="font-semibold text-purple-600">{artistToken.totalSubscribers}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Wallet Address</p>
                  <p className="font-mono text-xs">{artistToken.artistWalletAddress?.slice(0, 10)}...{artistToken.artistWalletAddress?.slice(-8)}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Token Contract Address</p>
                  <p className="font-mono text-xs">{artistToken.tokenAddress.slice(0, 10)}...{artistToken.tokenAddress.slice(-8)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Crown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Subscription Token Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your artist subscription token to allow fans to subscribe to your content
              </p>
              <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Subscription Token
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Subscription Token</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        This will create a unique subscription token for your fans. Each artist can only create one token.
                      </p>
                    </div>
                    <div>
                      <Label>Token Name *</Label>
                      <Input
                        value={tokenForm.tokenName}
                        onChange={(e) => setTokenForm({ ...tokenForm, tokenName: e.target.value })}
                        placeholder="My Artist Token"
                      />
                    </div>
                    <div>
                      <Label>Token Symbol *</Label>
                      <Input
                        value={tokenForm.tokenSymbol}
                        onChange={(e) => setTokenForm({ ...tokenForm, tokenSymbol: e.target.value.toUpperCase() })}
                        placeholder="ART"
                        maxLength={5}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        3-5 characters (e.g., ART, MUSIC, STAR)
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (!tokenForm.tokenName || !tokenForm.tokenSymbol) {
                          toast({
                            title: "Error",
                            description: "Please fill in all fields",
                            variant: "destructive"
                          });
                          return;
                        }
                        createTokenMutation.mutate(tokenForm);
                      }}
                      disabled={createTokenMutation.isPending}
                      className="w-full"
                    >
                      {createTokenMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Token
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscribers List - Show always, not just when token exists */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            My Subscribers ({subscribers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
            {subscribersLoading ? (
              <div className="flex justify-center py-8">
                <Loading size="md" text="Loading subscribers..." />
              </div>
            ) : subscribers.length > 0 ? (
              <div className="space-y-3">
                {subscribers.map((sub, index) => (
                  <div key={sub.wallet || index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {sub.subscriber?.name?.charAt(0).toUpperCase() || sub.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium">{sub.subscriber?.name || sub.username || "Unknown User"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.wallet && `${sub.wallet.slice(0, 6)}...${sub.wallet.slice(-4)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Subscribed {new Date(sub.subscribedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <Heart className="w-3 h-3 mr-1" />
                      Subscriber
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No subscribers yet. Share your wallet address with fans so they can subscribe!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
    </TabsContent>
  );
}
