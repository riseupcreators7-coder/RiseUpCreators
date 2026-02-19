import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Facebook, Instagram, Users, TrendingUp, RefreshCw, ExternalLink, Download, BarChart3, GitCompare } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Loading from "@/components/common/loading";
import AdminMetaModeration from "./admin-meta-moderation";

export default function AdminMetaAnalytics() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState("followers");
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("analytics");

  // Fetch overview stats
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ["/api/admin/meta/overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/meta/overview", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
  });

  // Fetch top artists
  const { data: topArtists, isLoading: topArtistsLoading } = useQuery({
    queryKey: ["/api/admin/meta/top-artists", platformFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/meta/top-artists?platform=${platformFilter}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch top artists");
      return res.json();
    },
  });

  // Fetch all artists
  const { data: artistsData, isLoading: artistsLoading } = useQuery({
    queryKey: ["/api/admin/meta/artists", platformFilter, sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/admin/meta/artists?platform=${platformFilter}&sortBy=${sortBy}&limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch artists");
      return res.json();
    },
  });

  // Fetch trends data
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["/api/admin/meta/trends"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/meta/trends?days=30`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchOverview();
  };

  // Export to CSV function
  const exportToCSV = () => {
    const artists = artistsData?.data || [];
    if (artists.length === 0) {
      alert("No data to export");
      return;
    }

    // CSV headers
    const headers = ["Artist Name", "Facebook Page", "Facebook Followers", "Instagram Username", "Instagram Followers", "Total Followers", "Last Synced"];
    
    // CSV rows
    const rows = artists.map((artist: any) => [
      artist.artistName,
      artist.facebook?.pageName || "Not connected",
      artist.facebook?.followersCount || 0,
      artist.instagram?.username || "Not connected",
      artist.instagram?.followersCount || 0,
      artist.totalFollowers,
      artist.facebook?.lastSyncedAt || artist.instagram?.lastSyncedAt
        ? new Date(
            Math.max(
              new Date(artist.facebook?.lastSyncedAt || 0).getTime(),
              new Date(artist.instagram?.lastSyncedAt || 0).getTime()
            )
          ).toLocaleDateString()
        : "Never"
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `meta-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle artist selection for comparison
  const toggleArtistSelection = (userId: string) => {
    setSelectedArtists(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : prev.length < 5 ? [...prev, userId] : prev
    );
  };

  // Get selected artists data for comparison
  const getComparisonData = () => {
    const artists = artistsData?.data || [];
    return artists.filter((artist: any) => selectedArtists.includes(artist.userId));
  };

  if (overviewLoading) {
    return <Loading text="Loading Meta analytics..." />;
  }

  const stats = overview?.data;
  const artists = artistsData?.data || [];
  const topPerformers = topArtists?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Meta Platform Management</h2>
        <p className="text-muted-foreground">Analytics, moderation, and insights for Facebook and Instagram</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analytics">Analytics & Insights</TabsTrigger>
          <TabsTrigger value="moderation">Content Moderation</TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Artists</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalArtistsConnected || 0}</div>
            <p className="text-xs text-muted-foreground">Connected to Meta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Facebook Pages</CardTitle>
            <Facebook className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.facebook?.totalPages || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(stats?.facebook?.totalFollowers || 0).toLocaleString()} total followers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Instagram Accounts</CardTitle>
            <Instagram className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.instagram?.totalAccounts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(stats?.instagram?.totalFollowers || 0).toLocaleString()} total followers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.facebook?.avgFollowersPerPage || 0}
            </div>
            <p className="text-xs text-muted-foreground">Avg followers per page</p>
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Connection Trends (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Loading text="Loading trends..." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="facebookConnections" 
                  stroke="#1877f2" 
                  name="Facebook" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="instagramConnections" 
                  stroke="#e4405f" 
                  name="Instagram" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalConnections" 
                  stroke="#10b981" 
                  name="Total" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Artists */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Performing Artists</CardTitle>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook Only</SelectItem>
                <SelectItem value="instagram">Instagram Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {topArtistsLoading ? (
            <Loading text="Loading top artists..." />
          ) : topPerformers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No artists found</p>
          ) : (
            <div className="space-y-4">
              {topPerformers.map((artist: any, index: number) => (
                <div key={artist.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold">{artist.artistName}</h4>
                      <div className="flex gap-2 mt-1">
                        {artist.facebook && (
                          <a
                            href={artist.facebook.pageLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Badge variant="outline" className="text-xs hover:bg-blue-50 cursor-pointer">
                              <Facebook className="w-3 h-3 mr-1" />
                              {artist.facebook.pageName}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Badge>
                          </a>
                        )}
                        {artist.instagram && (
                          <a
                            href={`https://instagram.com/${artist.instagram.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Badge variant="outline" className="text-xs hover:bg-pink-50 cursor-pointer">
                              <Instagram className="w-3 h-3 mr-1" />
                              @{artist.instagram.username}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Badge>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{artist.totalFollowers.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Total Followers</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Artists Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Connected Artists</CardTitle>
            <div className="flex gap-2">
              {selectedArtists.length > 0 && (
                <Button 
                  onClick={() => setCompareDialogOpen(true)} 
                  variant="default" 
                  size="sm"
                >
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare ({selectedArtists.length})
                </Button>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="followers">Most Followers</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="recent">Recently Connected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {artistsLoading ? (
            <Loading text="Loading artists..." />
          ) : artists.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No artists found</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedArtists.length === artists.length && artists.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedArtists(artists.slice(0, 5).map((a: any) => a.userId));
                          } else {
                            setSelectedArtists([]);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Facebook</TableHead>
                    <TableHead>Instagram</TableHead>
                    <TableHead className="text-right">Total Followers</TableHead>
                    <TableHead className="text-right">Last Synced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artists.map((artist: any) => (
                    <TableRow key={artist.userId} className="hover:bg-muted/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedArtists.includes(artist.userId)}
                          onChange={() => toggleArtistSelection(artist.userId)}
                          disabled={!selectedArtists.includes(artist.userId) && selectedArtists.length >= 5}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{artist.artistName}</TableCell>
                      <TableCell>
                        {artist.facebook ? (
                          <a
                            href={artist.facebook.pageLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                {artist.facebook.pageName}
                                <ExternalLink className="w-3 h-3" />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {artist.facebook.followersCount.toLocaleString()} followers
                              </div>
                            </div>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Not connected</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {artist.instagram ? (
                          <a
                            href={`https://instagram.com/${artist.instagram.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                @{artist.instagram.username}
                                <ExternalLink className="w-3 h-3" />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {artist.instagram.followersCount.toLocaleString()} followers
                              </div>
                            </div>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Not connected</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {artist.totalFollowers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {artist.facebook?.lastSyncedAt || artist.instagram?.lastSyncedAt
                          ? new Date(
                              Math.max(
                                new Date(artist.facebook?.lastSyncedAt || 0).getTime(),
                                new Date(artist.instagram?.lastSyncedAt || 0).getTime()
                              )
                            ).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Moderation Tab */}
        <TabsContent value="moderation" className="mt-6">
          <AdminMetaModeration />
        </TabsContent>
      </Tabs>

      {/* Artist Comparison Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Artist Comparison</DialogTitle>
            <DialogDescription>
              Compare up to 5 artists side by side
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Comparison Chart */}
            <div>
              <h3 className="text-sm font-medium mb-4">Follower Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getComparisonData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="artistName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="facebook.followersCount" fill="#1877f2" name="Facebook Followers" />
                  <Bar dataKey="instagram.followersCount" fill="#e4405f" name="Instagram Followers" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Comparison Table */}
            <div>
              <h3 className="text-sm font-medium mb-4">Detailed Comparison</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {getComparisonData().map((artist: any) => (
                        <TableHead key={artist.userId}>{artist.artistName}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Facebook Page</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId}>
                          {artist.facebook?.pageName || "Not connected"}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Facebook Followers</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId}>
                          {(artist.facebook?.followersCount || 0).toLocaleString()}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Instagram Username</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId}>
                          {artist.instagram?.username ? `@${artist.instagram.username}` : "Not connected"}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Instagram Followers</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId}>
                          {(artist.instagram?.followersCount || 0).toLocaleString()}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Instagram Posts</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId}>
                          {(artist.instagram?.mediaCount || 0).toLocaleString()}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Followers</TableCell>
                      {getComparisonData().map((artist: any) => (
                        <TableCell key={artist.userId} className="font-semibold">
                          {artist.totalFollowers.toLocaleString()}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
