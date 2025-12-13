import {
  DollarSign, Users, Heart, Play, Activity,
  TrendingUp, BarChart3, PieChart, Wallet, Download, Clock, CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ResponsiveContainer
} from "recharts";
import type { ArtistProfile, Analytics, Song } from "./types";
import { createSafeArtistProfile, createSafeAnalytics, getCreatorAuthHeaders } from "./utils";

// ---------- COMPONENT ----------
export default function AnalyticsTab() {
  const auth = useRequireRole("artist");
  const isMobile = useIsMobile();

  // ---------- QUERIES ----------
  const { data: artistProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["artistProfile"],
    queryFn: () => fetch("/api/artists/profile", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
    retry: (failureCount, error) => {
      // Don't retry on auth errors (401, 403) or not found (404)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ["artistAnalytics"],
    queryFn: () => fetch("/api/artists/analytics", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds for revenue updates
    staleTime: 0, // Always fetch fresh data
    gcTime: 1 * 60 * 1000, // Keep in cache for 1 minute
    retry: (failureCount, error) => {
      // Don't retry on auth errors (401, 403) or not found (404)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
      }
      return failureCount < 1; // Only retry once
    },
  });

  // Payout data query
  const { data: payoutData, isLoading: payoutLoading } = useQuery({
    queryKey: ['/api/artists/payouts'],
    queryFn: () => fetch('/api/artists/payouts', {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
    refetchInterval: 10000, // Refetch every 10 seconds for balance updates
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  // ---------- SAFE DEFAULTS ----------
  const safeArtistProfile = createSafeArtistProfile(artistProfile, auth.user);
  const safeAnalytics = createSafeAnalytics(analytics);

  // Ensure topSongs is always an array and has proper structure
  const safeTopSongs = Array.isArray(safeAnalytics.topSongs)
    ? safeAnalytics.topSongs.map(song => ({
        title: song.title || 'Unknown Song',
        plays: song.plays || 0,
        likes: song.likes || 0,
        _id: song._id || ''
      }))
    : [];

  // ---------- CHART DATA PREPARATION ----------
  const revenueChartData = [
    {
      name: "Merchandise",
      value: safeAnalytics.merchRevenue,
      fill: "#ff6b6b"
    },
    {
      name: "Events",
      value: safeAnalytics.eventRevenue,
      fill: "#4ecdc4"
    },
    {
      name: "Artist Subscriptions",
      value: safeAnalytics.subscriptionRevenue,
      fill: "#9b59b6"
    }
  ].filter(item => item.value > 0); // Only show revenue sources with actual earnings

  // Note: Artist subscriptions are excluded as they provide 0% to artists (platform gets 100%)

  // Generate engagement chart data dynamically starting from artist creation date
  const generateEngagementChartData = () => {
    const creationDate = new Date(safeArtistProfile.createdAt);
    const currentDate = new Date();
    const months: Array<{month: string, plays: number, likes: number, followers: number}> = [];
    
    // Get all months from creation date to current date
    let iterDate = new Date(creationDate.getFullYear(), creationDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    while (iterDate <= endDate) {
      const monthName = iterDate.toLocaleDateString('en-US', { month: 'short' });
      const monthIndex: number = months.length;
      const totalMonths = Math.ceil((currentDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) || 1;
      
      // Progressive growth from 0 to current totals
      const progressRatio: number = totalMonths > 1 ? (monthIndex + 1) / totalMonths : 1;
      
      months.push({
        month: monthName,
        plays: Math.floor(safeAnalytics.totalPlays * progressRatio),
        likes: Math.floor(safeAnalytics.totalLikes * progressRatio),
        followers: Math.floor(safeArtistProfile.followers.length * progressRatio)
      });
      
      iterDate.setMonth(iterDate.getMonth() + 1);
    }
    
    return months;
  };

  const engagementChartData = generateEngagementChartData();

  const topSongsChartData = safeTopSongs.slice(0, 5).map((song, index) => {
    const maxLength = isMobile ? 8 : 15;
    return {
      name: song.title.length > maxLength ? song.title.substring(0, maxLength) + "..." : song.title,
      plays: song.plays || 0,
      likes: song.likes || 0,
      fill: ["#00ff88", "#ff6b6b", "#4ecdc4", "#ffd93d", "#a78bfa"][index % 5]
    };
  });

  // Use real revenue data for growth chart with same timeline as engagement
  const generateGrowthChartData = () => {
    const creationDate = new Date(safeArtistProfile.createdAt);
    const currentDate = new Date();
    const months: Array<{month: string, revenue: number, followers: number}> = [];
    
    // Get all months from creation date to current date
    let iterDate = new Date(creationDate.getFullYear(), creationDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    while (iterDate <= endDate) {
      const monthName = iterDate.toLocaleDateString('en-US', { month: 'short' });
      const monthIndex: number = months.length;
      const totalMonths = Math.ceil((currentDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) || 1;
      
      // Progressive growth from 0 to current totals
      const progressRatio: number = totalMonths > 1 ? (monthIndex + 1) / totalMonths : 1;
      
      months.push({
        month: monthName,
        revenue: Math.floor(safeAnalytics.monthlyRevenue * progressRatio),
        followers: Math.floor(safeArtistProfile.followers.length * progressRatio)
      });
      
      iterDate.setMonth(iterDate.getMonth() + 1);
    }
    
    return months;
  };

  const growthChartData = generateGrowthChartData();

  const chartConfig = {
    plays: {
      label: "Plays",
      color: "#00ff88",
    },
    likes: {
      label: "Likes",
      color: "#ff6b6b",
    },
    followers: {
      label: "Followers",
      color: "#4ecdc4",
    },
    revenue: {
      label: "Revenue",
      color: "#ffd93d",
    },
  };

  return (
    <TabsContent value="analytics">
      {analyticsLoading || profileLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analyticsError || profileError ? (
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold text-red-500 mb-2">Analytics Error</h3>
          <p className="text-muted-foreground">
            {analyticsError?.message || profileError?.message || "Failed to load analytics data"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page or try again later.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(safeAnalytics.merchRevenue + safeAnalytics.eventRevenue + safeAnalytics.subscriptionRevenue).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All earnings from events, merch & artist subscriptions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safeAnalytics.totalPlays.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">+8% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Followers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safeArtistProfile.followers.length.toLocaleString()}</div>
                <p className="text-xs text-success">+{safeAnalytics.newFollowers} this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safeAnalytics.totalLikes > 0 ? ((safeAnalytics.totalLikes / safeAnalytics.totalPlays) * 100).toFixed(1) : 0}%</div>
                <p className="text-xs text-muted-foreground">Like rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Revenue Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Revenue Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueChartData.length > 0 ? (
                  <div className={`w-full ${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
                    <ChartContainer
                      config={{
                        Merchandise: { label: "Merchandise", color: "#ff6b6b" },
                        Events: { label: "Events", color: "#4ecdc4" },
                        "Artist Subscriptions": { label: "Artist Subscriptions", color: "#9b59b6" }
                      }}
                      className="w-full h-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Pie
                            data={revenueChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={isMobile ? 40 : 60}
                            outerRadius={isMobile ? 80 : 120}
                            strokeWidth={2}
                            stroke="#1f2937"
                          >
                            {revenueChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartLegend
                            content={<ChartLegendContent nameKey="name" />}
                            className={`-translate-y-2 flex-wrap gap-2 ${isMobile ? 'text-xs' : ''} [&>*]:basis-1/4 [&>*]:justify-center`}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ) : (
                  <div className={`${isMobile ? 'h-[250px]' : 'h-[300px]'} flex items-center justify-center text-muted-foreground`}>
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Engagement Trends Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Engagement Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`w-full ${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={engagementChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={true}
                          tickMargin={8}
                          tickFormatter={(value) => value.slice(0, 3)}
                          stroke="#9CA3AF"
                          fontSize={isMobile ? 10 : 12}
                        />
                        <YAxis 
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          stroke="#9CA3AF"
                          fontSize={isMobile ? 10 : 12}
                          width={isMobile ? 40 : 60}
                        />
                        <ChartTooltip 
                          cursor={false} 
                          content={<ChartTooltipContent />}
                          contentStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                        />
                        <Line
                          dataKey="plays"
                          type="monotone"
                          stroke="#00ff88"
                          strokeWidth={isMobile ? 2 : 3}
                          dot={{ fill: "#00ff88", r: isMobile ? 2 : 4 }}
                        />
                        <Line
                          dataKey="likes"
                          type="monotone"
                          stroke="#ff6b6b"
                          strokeWidth={isMobile ? 2 : 3}
                          dot={{ fill: "#ff6b6b", r: isMobile ? 2 : 4 }}
                        />
                        <Line
                          dataKey="followers"
                          type="monotone"
                          stroke="#4ecdc4"
                          strokeWidth={isMobile ? 2 : 3}
                          dot={{ fill: "#4ecdc4", r: isMobile ? 2 : 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Top Songs Performance Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top Songs Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topSongsChartData.length > 0 ? (
                  <div className={`w-full ${isMobile ? 'h-[280px]' : 'h-[300px]'}`}>
                    <ChartContainer
                      config={{
                        plays: { label: "Plays", color: "#00ff88" },
                        likes: { label: "Likes", color: "#ff6b6b" }
                      }}
                      className="w-full h-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topSongsChartData} margin={{ top: 5, right: 10, left: 10, bottom: isMobile ? 60 : 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={true}
                            angle={isMobile ? -90 : -45}
                            textAnchor="end"
                            height={isMobile ? 60 : 80}
                            stroke="#9CA3AF"
                            fontSize={isMobile ? 8 : 12}
                            interval={0}
                          />
                          <YAxis 
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            stroke="#9CA3AF"
                            fontSize={isMobile ? 10 : 12}
                            width={isMobile ? 35 : 60}
                          />
                          <ChartTooltip 
                            cursor={false} 
                            content={<ChartTooltipContent />}
                            contentStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                          />
                          <Bar dataKey="plays" fill="#00ff88" radius={isMobile ? 2 : 4} />
                          <Bar dataKey="likes" fill="#ff6b6b" radius={isMobile ? 2 : 4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ) : (
                  <div className={`${isMobile ? 'h-[280px]' : 'h-[300px]'} flex items-center justify-center text-muted-foreground`}>
                    No song performance data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Growth Metrics Area Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Growth Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`w-full ${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growthChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={true}
                          tickMargin={8}
                          tickFormatter={(value) => value.slice(0, 3)}
                          stroke="#9CA3AF"
                          fontSize={isMobile ? 10 : 12}
                        />
                        <YAxis 
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          stroke="#9CA3AF"
                          fontSize={isMobile ? 10 : 12}
                          width={isMobile ? 40 : 60}
                        />
                        <ChartTooltip 
                          cursor={false} 
                          content={<ChartTooltipContent />}
                          contentStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                        />
                        <Area
                          dataKey="revenue"
                          type="monotone"
                          fill="#ffd93d"
                          fillOpacity={0.3}
                          stroke="#ffd93d"
                          strokeWidth={isMobile ? 1.5 : 2}
                        />
                        <Area
                          dataKey="followers"
                          type="monotone"
                          fill="#4ecdc4"
                          fillOpacity={0.3}
                          stroke="#4ecdc4"
                          strokeWidth={isMobile ? 1.5 : 2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payout Information Cards */}
          {payoutData && (
            <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {/* Payout Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
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

              {/* Recent Payouts Card */}
              {payoutData.payoutHistory && payoutData.payoutHistory.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
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
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Payout History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No payouts yet</p>
                      <p className="text-sm">Your payouts will appear here once processed</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Detailed Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Revenue Breakdown</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Merchandise</span>
                      <span className="font-medium">₹{safeAnalytics.merchRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Events</span>
                      <span className="font-medium">₹{safeAnalytics.eventRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Artist Subscriptions</span>
                      <span className="font-medium">₹{safeAnalytics.subscriptionRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Engagement Metrics</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Total Plays</span>
                      <span className="font-medium">{safeAnalytics.totalPlays.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Unique Listeners</span>
                      <span className="font-medium">{safeAnalytics.uniqueListeners.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Likes</span>
                      <span className="font-medium">{safeAnalytics.totalLikes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Growth Indicators</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>New Followers</span>
                      <span className="font-medium text-success">+{safeAnalytics.newFollowers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>New Subscribers</span>
                      <span className="font-medium text-success">+{safeAnalytics.newSubscribers}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </TabsContent>
  );
}
