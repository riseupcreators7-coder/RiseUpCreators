import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Users, Music, DollarSign, TrendingUp, Calendar, 
  Play, Heart, Search, BarChart3, Eye, MousePointer,
  Wallet, CreditCard, Clock, CheckCircle, Download
} from "lucide-react";
import Loading from "@/components/common/loading";

interface UnifiedAnalyticsDashboardProps {
  /** User role determines which analytics are shown */
  userRole?: 'admin' | 'artist' | 'fan';
  /** Override the scope - useful for admin viewing specific user/artist data */
  scope?: 'platform' | 'artist' | 'user' | 'auto';
  /** Specific user/artist ID to view (admin only) */
  targetId?: string;
}

export default function UnifiedAnalyticsDashboard({ 
  userRole = 'fan', 
  scope = 'auto',
  targetId 
}: UnifiedAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState("30");
  const isMobile = useIsMobile();

  // Build query parameters
  const queryParams = new URLSearchParams({
    scope,
    days: timeRange,
    ...(targetId && { [scope === 'artist' ? 'artistId' : 'userId']: targetId })
  });

  // Main analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: [`/api/analytics?${queryParams.toString()}`],
    queryFn: () => fetch(`/api/analytics?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
    enabled: true,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 401 || status === 403) return false;
      }
      return failureCount < 2;
    },
  });

  // Ads analytics (for admin and artists)
  const { data: adAnalytics, isLoading: adLoading } = useQuery({
    queryKey: [`/api/ads/analytics?timeRange=${timeRange}d`],
    queryFn: () => fetch(`/api/ads/analytics?timeRange=${timeRange}d`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
    enabled: userRole === 'admin' || userRole === 'artist',
    staleTime: 5 * 60 * 1000,
  });

  // Payout data (for artists only)
  const { data: payoutData, isLoading: payoutLoading } = useQuery({
    queryKey: ['/api/artists/payouts'],
    queryFn: () => fetch('/api/artists/payouts', {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
    enabled: userRole === 'artist',
    staleTime: 5 * 60 * 1000,
  });

  if (analyticsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loading size="lg" text="Loading analytics..." />
      </div>
    );
  }

  const data = analytics?.data;
  const effectiveScope = analytics?.scope || scope;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${isMobile ? 'space-y-4' : 'flex justify-between items-center'}`}>
        <div>
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
            {effectiveScope === 'platform' ? 'Platform Analytics' : 
             effectiveScope === 'artist' ? 'Artist Analytics' : 'User Analytics'}
          </h2>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
            {effectiveScope === 'platform' ? 'Overall platform performance' :
             effectiveScope === 'artist' ? 'Your artist performance metrics' :
             'Your personal listening statistics'}
          </p>
        </div>
        <div className={`flex items-center space-x-2 ${isMobile ? 'justify-start' : ''}`}>
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className={`${isMobile ? 'w-40' : 'w-32'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
        {effectiveScope === 'platform' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalSignups?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">New users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.dau?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Active today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.mau?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Active this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(data?.retentionRate7d || 0)}%</div>
                <p className="text-xs text-muted-foreground">7-day retention</p>
              </CardContent>
            </Card>
          </>
        )}

        {effectiveScope === 'artist' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalPlays?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Song plays</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Listeners</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.uniqueListeners?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Different users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{data?.monthlyRevenue?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Followers</CardTitle>
                <Heart className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.newFollowers?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">This period</p>
              </CardContent>
            </Card>
          </>
        )}

        {effectiveScope === 'user' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Songs Played</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalPlays?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Total plays</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Songs Liked</CardTitle>
                <Heart className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalLikes?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Liked songs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Artists Followed</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.totalFollows?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Following</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Listening Hours</CardTitle>
                <Music className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.listeningHours?.toFixed(1) || 0}</div>
                <p className="text-xs text-muted-foreground">Hours listened</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview" className={isMobile ? 'text-xs' : ''}>Overview</TabsTrigger>
          <TabsTrigger value="content" className={isMobile ? 'text-xs' : ''}>Content</TabsTrigger>
          {(userRole === 'admin' || userRole === 'artist') && (
            <TabsTrigger value="revenue" className={isMobile ? 'text-xs' : ''}>
              {isMobile ? 'Revenue' : 'Revenue'}
            </TabsTrigger>
          )}
          {(userRole === 'admin' || userRole === 'artist') && (
            <TabsTrigger value="ads" className={isMobile ? 'text-xs' : ''}>
              {isMobile ? 'Ads' : 'Advertising'}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {/* User Engagement Overview */}
            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {effectiveScope === 'platform' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">7-day retention</span>
                        <span className="font-medium">{Math.round(data?.retentionRate7d || 0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">30-day retention</span>
                        <span className="font-medium">{Math.round(data?.retentionRate30d || 0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Average session length</span>
                        <span className="font-medium">{data?.avgSessionLength || 0} min</span>
                      </div>
                    </>
                  )}
                  {effectiveScope === 'artist' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Conversion Rate</span>
                        <span className="font-medium">{data?.conversionRate || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Engagement Rate</span>
                        <span className="font-medium">{Math.round(data?.engagementRate || 0)}%</span>
                      </div>
                    </>
                  )}
                  {effectiveScope === 'user' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Session Count</span>
                        <span className="font-medium">{data?.sessionCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Favorite Genres</span>
                        <span className="font-medium">{data?.favoriteGenres?.join(', ') || 'None'}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Activity</span>
                    <span className="font-medium">{(data?.totalPlays || data?.totalSignups || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Growth Rate</span>
                    <span className="font-medium text-green-600">+{data?.growthRate || 0}%</span>
                  </div>
                  {effectiveScope === 'platform' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Platform Health</span>
                      <Badge variant="default" className="bg-green-500">Good</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            <Card>
              <CardHeader>
                <CardTitle>Content Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Plays</span>
                    <span className="font-medium">{data?.totalPlays?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Likes</span>
                    <span className="font-medium">{data?.totalLikes?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Shares</span>
                    <span className="font-medium">{data?.totalShares?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Engagement Rate</span>
                    <span className="font-medium">{Math.round(data?.engagementRate || 0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Content Quality Score</span>
                    <span className="font-medium">{data?.qualityScore || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Rating</span>
                    <span className="font-medium">{data?.avgRating?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        {(userRole === 'admin' || userRole === 'artist') && (
          <TabsContent value="revenue" className="space-y-6">
            <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Subscriptions</span>
                      <span className="font-medium">₹{data?.subscriptionRevenue?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Merchandise</span>
                      <span className="font-medium">₹{data?.merchRevenue?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Events</span>
                      <span className="font-medium">₹{data?.eventRevenue?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payout Information for Artists */}
              {userRole === 'artist' && payoutData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Payout Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Available Balance</span>
                        <span className="font-medium text-green-600">₹{payoutData.availableBalance?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Earned</span>
                        <span className="font-medium">₹{payoutData.totalEarnings?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Withdrawn</span>
                        <span className="font-medium">₹{payoutData.totalWithdrawn?.toLocaleString() || 0}</span>
                      </div>
                      {payoutData.processingAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Processing</span>
                          <span className="font-medium text-yellow-600">₹{payoutData.processingAmount?.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Earnings History for Artists */}
              {userRole === 'artist' && payoutData && payoutData.payoutHistory && payoutData.payoutHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Recent Payouts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {payoutData.payoutHistory.slice(0, 5).map((payout: any) => (
                        <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${
                              payout.status === 'completed' ? 'bg-green-500' :
                              payout.status === 'processing' ? 'bg-yellow-500' :
                              'bg-gray-500'
                            }`} />
                            <div>
                              <div className="font-medium text-sm">₹{payout.amount?.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(payout.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <Badge variant={
                            payout.status === 'completed' ? 'default' :
                            payout.status === 'processing' ? 'secondary' :
                            'outline'
                          } className={`text-xs ${
                            payout.status === 'completed' ? 'bg-green-100 text-green-800' :
                            payout.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            ''
                          }`}>
                            {payout.status === 'completed' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : payout.status === 'processing' ? (
                              <Clock className="h-3 w-3 mr-1" />
                            ) : null}
                            {payout.status}
                          </Badge>
                        </div>
                      ))}
                      {payoutData.payoutHistory.length > 5 && (
                        <div className="text-center pt-2">
                          <span className="text-sm text-muted-foreground">
                            {payoutData.payoutHistory.length - 5} more payouts...
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {effectiveScope === 'platform' && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>E-commerce</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Sales</span>
                          <span className="font-medium">{data?.merchAnalytics?.totalSales || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Revenue</span>
                          <span className="font-medium">₹{data?.merchAnalytics?.totalRevenue?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Active</span>
                          <span className="font-medium">{data?.subscriptionAnalytics?.activeSubscriptions || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Churn Rate</span>
                          <span className="font-medium">{data?.subscriptionAnalytics?.churnRate || 0}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>
        )}

        {/* Ads Tab */}
        {(userRole === 'admin' || userRole === 'artist') && (
          <TabsContent value="ads" className="space-y-6">
            {adLoading ? (
              <div className="flex justify-center py-8">
                <Loading size="md" text="Loading ad analytics..." />
              </div>
            ) : (
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ad Impressions</CardTitle>
                    <Eye className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adAnalytics?.totalImpressions?.toLocaleString() || 0}</div>
                    <p className="text-xs text-muted-foreground">Total views</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ad Clicks</CardTitle>
                    <MousePointer className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adAnalytics?.totalClicks?.toLocaleString() || 0}</div>
                    <p className="text-xs text-muted-foreground">User clicks</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adAnalytics?.ctr?.toFixed(2) || 0}%</div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ad Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₹{adAnalytics?.totalRevenue?.toLocaleString() || 0}</div>
                    <p className="text-xs text-muted-foreground">Total earnings</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}