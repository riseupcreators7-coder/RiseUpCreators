import { useState } from "react";
import { Crown, Package, Music, Heart, Calendar, Settings, CreditCard, Download, Star, Users, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { usePlayer } from "@/hooks/use-player";
import Loading from "@/components/common/loading";
import Sidebar from "@/components/layout/sidebar";
import { Link, useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const auth = useRequireAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Handle URL parameters for tabs
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || "overview");

  // State for subscription management
  const [managingSubscription, setManagingSubscription] = useState<string | null>(null);

  // Handle subscription management
  const handleManageSubscription = async (subscriptionId: string, action: 'cancel' | 'pause') => {
    try {
      setManagingSubscription(subscriptionId);
      const response = await fetch(`/api/subscriptions/${subscriptionId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} subscription`);
      }

      // Refresh subscriptions data
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      
      // Show success message
    } catch (error) {
      // Handle error
    } finally {
      setManagingSubscription(null);
    }
  };

  // Fetch user data
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["/api/subscriptions/me"],
    enabled: !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/orders/me"],
    enabled: !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: returns, isLoading: returnsLoading } = useQuery({
    queryKey: ["/api/returns/me"],
    enabled: !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ["/api/playlists/mine"],
    enabled: !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: favorites, isLoading: favoritesLoading } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    enabled: !!auth.user,
    staleTime: 5 * 60 * 1000,
  });

  if (auth.isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading your dashboard..." />
      </div>
    );
  }

  if (!auth.user) {
    return null;
  }

  return (
    <div className="min-h-screen pt-16 pb-24 flex">
      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-64">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">User Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Manage your account and preferences</p>
            </div>

            {(!auth.user.plan || auth.user.plan.type === "FREE") && (
              <Link href="/plans">
                <Button className="gradient-primary hover:opacity-90" data-testid="upgrade-button">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              </Link>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            window.history.pushState({}, '', `?tab=${value}`);
          }}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6 md:mb-8 h-auto gap-1">
              <TabsTrigger value="overview" data-testid="overview-tab" className="text-xs md:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="subscriptions" data-testid="subscriptions-tab" className="text-xs md:text-sm">Subscriptions</TabsTrigger>
              <TabsTrigger value="orders" data-testid="orders-tab" className="text-xs md:text-sm">Orders</TabsTrigger>
              <TabsTrigger value="returns" data-testid="returns-tab" className="text-xs md:text-sm">Returns</TabsTrigger>
              <TabsTrigger value="library" data-testid="library-tab" className="text-xs md:text-sm">Library</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Plan Status */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                    <Crown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{auth.user.plan?.type || 'FREE'}</div>
                    <p className="text-xs text-muted-foreground">
                      {auth.user.plan?.type === 'PREMIUM' ? 'Enjoy ad-free music' : 'Upgrade for premium features'}
                    </p>
                  </CardContent>
                </Card>

                {/* Subscriptions */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Array.isArray(subscriptions) ? subscriptions.length : 0}</div>
                    <p className="text-xs text-muted-foreground">Active artist subscriptions</p>
                  </CardContent>
                </Card>

                {/* Following */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Following</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{auth.user.following?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Artists you follow</p>
                  </CardContent>
                </Card>

                {/* Favorites */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Favorites</CardTitle>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{auth.user.favorites?.songs?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Liked songs</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Link href="/discover">
                      <Button variant="outline" className="w-full justify-start" data-testid="discover-music">
                        <Music className="w-4 h-4 mr-2" />
                        Discover Music
                      </Button>
                    </Link>
                    <Link href="/events">
                      <Button variant="outline" className="w-full justify-start" data-testid="browse-events">
                        <Calendar className="w-4 h-4 mr-2" />
                        Browse Events
                      </Button>
                    </Link>
                    <Link href="/settings">
                      <Button variant="outline" className="w-full justify-start" data-testid="account-settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Account Settings
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        No recent activity to show.
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Start listening to music and following artists to see your activity here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions">
              {subsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : subscriptions && Array.isArray(subscriptions) && subscriptions.length > 0 ? (
                <div className="space-y-4">
                  {subscriptions.map((subscription: any, index: number) => (
                    <Card key={subscription._id} data-testid={`subscription-${index}`}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">
                              {subscription.artistName || 'Artist'} Subscription
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {subscription.tier} tier - ₹{subscription.amount}/month
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {subscription.active ? 'Active' : 'Inactive'} • 
                              Renews on {new Date(subscription.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={subscription.active ? "default" : "secondary"}>
                              {subscription.active ? "Active" : "Inactive"}
                            </Badge>
                            {subscription.active ? (
                              <div className="flex space-x-1">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  disabled={managingSubscription === subscription._id}
                                  onClick={() => handleManageSubscription(subscription._id, 'pause')}
                                >
                                  {managingSubscription === subscription._id ? "Processing..." : "Pause"}
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  disabled={managingSubscription === subscription._id}
                                  onClick={() => handleManageSubscription(subscription._id, 'cancel')}
                                >
                                  {managingSubscription === subscription._id ? "Processing..." : "Cancel"}
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                Inactive
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Star className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No subscriptions</h3>
                    <p className="text-muted-foreground mb-4">
                      Subscribe to artists to access exclusive content and support your favorite creators.
                    </p>
                    <Link href="/discover">
                      <Button data-testid="find-artists-to-subscribe">Find Artists to Subscribe</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : orders && Array.isArray(orders) && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order: any, index: number) => (
                    <Card 
                      key={order._id} 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setLocation(`/order-tracking/${order._id}`)}
                      data-testid={`order-${index}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Order #{order._id.slice(-6)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {order.type} • ₹{order.totalAmount} • {order.items.length} item(s)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Ordered on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={
                                order.status === 'PAID' ? "default" : 
                                order.status === 'PENDING' ? "secondary" : 
                                "destructive"
                              }
                            >
                              {order.status}
                            </Badge>
                            {order.status === 'PAID' && order.type === 'TICKET' && (
                              <Button variant="outline" size="sm" data-testid="download-ticket">
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setLocation(`/order-tracking/${order._id}`)}
                            >
                              Track Order
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                    <p className="text-muted-foreground mb-4">
                      When you buy merchandise, tickets, or premium plans, your orders will appear here.
                    </p>
                    <div className="flex space-x-4 justify-center">
                      <Link href="/merch">
                        <Button variant="outline">Browse Merch</Button>
                      </Link>
                      <Link href="/events">
                        <Button variant="outline">Find Events</Button>
                      </Link>
                      <Link href="/plans">
                        <Button>View Plans</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns">
              {returnsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : returns && Array.isArray(returns) && returns.length > 0 ? (
                <div className="space-y-4">
                  {returns.map((returnRequest: any, index: number) => (
                    <Card key={returnRequest._id} data-testid={`return-${index}`}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Return Request #{returnRequest._id.slice(-6)}</h3>
                            <p className="text-sm text-muted-foreground">
                              Order #{returnRequest.orderId.slice(-6)} • ₹{returnRequest.refundAmount} refund
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested on {new Date(returnRequest.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {returnRequest.reason}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={
                                returnRequest.status === 'APPROVED' ? "default" :
                                returnRequest.status === 'REQUESTED' ? "secondary" :
                                returnRequest.status === 'REJECTED' ? "destructive" :
                                "outline"
                              }
                            >
                              {returnRequest.status}
                            </Badge>
                          </div>
                        </div>
                        {returnRequest.items && returnRequest.items.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium mb-2">Items to return:</h4>
                            <div className="space-y-2">
                              {returnRequest.items.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="text-sm text-muted-foreground">
                                  • {item.quantity}x item • Condition: {item.condition}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No return requests</h3>
                    <p className="text-muted-foreground mb-4">
                      Your return requests will appear here. You can request returns for eligible orders within 30 days.
                    </p>
                    <Link href="/dashboard?tab=orders">
                      <Button variant="outline">View Orders</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Library Tab */}
            <TabsContent value="library">
              <div className="space-y-8">
                {/* Playlists */}
                <section>
                  <h2 className="text-xl font-bold mb-4">Playlists</h2>
                  {playlistsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                          <CardContent className="p-4">
                            <div className="h-4 bg-muted rounded mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : playlists && Array.isArray(playlists) && playlists.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {playlists.map((playlist: any, index: number) => (
                        <Card key={playlist._id} className="cursor-pointer hover-glow" data-testid={`playlist-${index}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                                <Music className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{playlist.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {playlist.songs?.length || 0} songs
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="text-center py-8">
                      <CardContent>
                        <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-semibold mb-1">No playlists yet</h3>
                        <p className="text-sm text-muted-foreground">Create your first playlist to organize your favorite songs.</p>
                      </CardContent>
                    </Card>
                  )}
                </section>

                {/* Favorite Songs */}
                <section>
                  <h2 className="text-xl font-bold mb-4">Favorite Songs</h2>
                  {favoritesLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-4 rounded-lg animate-pulse">
                          <div className="w-12 h-12 bg-muted rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded mb-1"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : favorites && (favorites as any).songs && Array.isArray((favorites as any).songs) && (favorites as any).songs.length > 0 ? (
                    <div className="space-y-2">
                      {((favorites as any).songs as any[]).slice(0, 10).map((song: any, index: number) => (
                        <div 
                          key={song._id}
                          className="flex items-center space-x-4 p-4 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            // Play functionality can be implemented here
                          }}
                          data-testid={`favorite-song-${index}`}
                        >
                          <img 
                            src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"}
                            alt={song.title}
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100";
                            }}
                          />
                          <div className="flex-1">
                            <h4 className="font-medium">{song.title}</h4>
                            <p className="text-sm text-muted-foreground">{song.artistName || "Artist Name"}</p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Heart className="w-4 h-4 fill-current text-primary" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Card className="text-center py-8">
                      <CardContent>
                        <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-semibold mb-1">No favorite songs</h3>
                        <p className="text-sm text-muted-foreground">Like songs to add them to your favorites.</p>
                      </CardContent>
                    </Card>
                  )}
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
