import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  MousePointer, 
  Eye, 
  PlayCircle,
  DollarSign,
  RefreshCw 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AdAnalyticsData {
  adId?: string;
  totalImpressions: number;
  totalClicks: number;
  totalCompletions?: number;
  overallCtr: number;
  revenue?: number;
  period: string;
  activeAds?: {
    audio: number;
    banner: number;
  };
  topPerformers?: Array<{
    adId: string;
    title: string;
    type: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
}

export default function AdAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [selectedAdType, setSelectedAdType] = useState("all");

  // Fetch overall analytics
  const { 
    data: analyticsData, 
    isLoading: analyticsLoading, 
    refetch,
    error 
  } = useQuery<AdAnalyticsData>({
    queryKey: ["/api/ads/analytics", selectedPeriod, selectedAdType],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: selectedPeriod,
        ...(selectedAdType !== "all" && { type: selectedAdType })
      });
      
      const response = await fetch(`/api/ads/analytics?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  // Fetch detailed ad performance
  const { data: adPerformanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/ads/performance", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/admin/ads/performance?period=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint doesn't exist yet, return empty data
          return { ads: [] };
        }
        throw new Error("Failed to fetch ad performance");
      }
      
      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Analytics refreshed",
      description: "Latest ad performance data has been loaded"
    });
  };

  if (error) {
    console.error("Analytics error:", error);
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading analytics</div>
        <div className="text-sm text-muted-foreground mb-4">
          {error.message || "Failed to load ad analytics"}
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const data = analyticsData || {
    totalImpressions: 0,
    totalClicks: 0,
    totalCompletions: 0,
    overallCtr: 0,
    revenue: 0,
    period: selectedPeriod,
    activeAds: { audio: 0, banner: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ad Analytics</h2>
          <p className="text-muted-foreground">
            Real-time performance metrics for your advertising campaigns
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedAdType} onValueChange={setSelectedAdType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ads</SelectItem>
              <SelectItem value="AUDIO">Audio Only</SelectItem>
              <SelectItem value="BANNER">Banner Only</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleRefresh} variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalImpressions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === "1d" ? "in last 24 hours" : 
               selectedPeriod === "7d" ? "in last 7 days" : "in last 30 days"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalClicks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              User interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overallCtr}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totalImpressions > 0 ? "Performance metric" : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Ads</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.activeAds?.audio || 0) + (data.activeAds?.banner || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.activeAds?.audio || 0} audio • {data.activeAds?.banner || 0} banner
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Ad Performance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Impressions</span>
                    <span className="font-bold">{data.totalImpressions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Clicks</span>
                    <span className="font-bold">{data.totalClicks.toLocaleString()}</span>
                  </div>
                  {data.totalCompletions !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Completions</span>
                      <span className="font-bold">{data.totalCompletions.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">CTR</span>
                    <span className="font-bold text-green-600">{data.overallCtr}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Ads</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Most active ads in selected period
                </p>
              </CardHeader>
              <CardContent>
                {data.topPerformers && data.topPerformers.length > 0 ? (
                  <div className="space-y-3">
                    {data.topPerformers.slice(0, 5).map((ad: any, index: number) => (
                      <div key={ad.adId} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{ad.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {ad.type?.toLowerCase()} ad
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{ad.ctr}% CTR</p>
                          <p className="text-xs text-muted-foreground">
                            {ad.impressions} views
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No performance data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Individual Ad Performance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Detailed metrics for each active advertisement
              </p>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading performance data...</p>
                </div>
              ) : adPerformanceData?.ads?.length > 0 ? (
                <div className="space-y-4">
                  {adPerformanceData.ads.map((ad: any) => (
                    <div key={ad.adId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{ad.title}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-muted-foreground capitalize">
                              {ad.type?.toLowerCase()} ad
                            </p>
                            <span className="text-sm text-muted-foreground">•</span>
                            <p className="text-sm text-muted-foreground">
                              Status: {ad.status}
                            </p>
                          </div>
                          {ad.placements && ad.placements.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Placements: {ad.placements.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{ad.ctr}% CTR</p>
                          <p className="text-xs text-muted-foreground">
                            Click-through rate
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-muted-foreground mb-1">Impressions</p>
                          <p className="font-bold text-lg">{ad.impressions.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-muted-foreground mb-1">Clicks</p>
                          <p className="font-bold text-lg">{ad.clicks.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-muted-foreground mb-1">Completions</p>
                          <p className="font-bold text-lg">{(ad.completions || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-muted-foreground mb-1">Completion Rate</p>
                          <p className="font-bold text-lg">{ad.completionRate || 0}%</p>
                        </div>
                      </div>
                      {ad.createdAt && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Created: {new Date(ad.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No performance data available</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Create and run some ads to see performance metrics
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ad revenue and earnings breakdown
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Revenue tracking coming soon</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Advanced revenue analytics and reporting features are in development
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
