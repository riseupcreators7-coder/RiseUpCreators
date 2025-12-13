import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { 
  Music, 
  Image, 
  Calendar, 
  Video, 
  Users, 
  Eye, 
  Heart, 
  Play, 
  Pause, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search
} from "lucide-react";
import Loading from "@/components/common/loading";

export default function AdminContentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();

  // Fetch songs
  const { data: songsData, isLoading: songsLoading } = useQuery({
    queryKey: ["/api/admin/songs", statusFilter],
    queryFn: () => fetch(`/api/admin/songs?status=${statusFilter}&limit=50`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
  });

  // Fetch events
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/admin/events"],
    queryFn: () => fetch("/api/admin/events?limit=50", {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
  });

  // Fetch merchandise
  const { data: merchData, isLoading: merchLoading } = useQuery({
    queryKey: ["/api/admin/merchandise"],
    queryFn: () => fetch("/api/admin/merchandise?limit=50", {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
  });

  // Update content status mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ contentType, contentId, status }: { contentType: string; contentId: string; status: string }) => {
      const response = await fetch(`/api/admin/${contentType}/${contentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error(`Failed to update ${contentType}`);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.contentType}`] });
      toast({ title: "Success", description: `${variables.contentType} updated successfully` });
    },
    onError: (error, variables) => {
      toast({ title: "Error", description: `Failed to update ${variables.contentType}`, variant: "destructive" });
    }
  });

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async ({ contentType, contentId }: { contentType: string; contentId: string }) => {
      const response = await fetch(`/api/admin/${contentType}/${contentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error(`Failed to delete ${contentType}`);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.contentType}`] });
      toast({ title: "Success", description: `${variables.contentType} deleted successfully` });
    },
    onError: (error, variables) => {
      toast({ title: "Error", description: `Failed to delete ${variables.contentType}`, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
      case 'PUBLISHED':
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-500">Published</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter content based on search and filters
  const filteredSongs = songsData?.songs?.filter((song: any) =>
    (song.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     song.artistName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (statusFilter === 'all' || song.status === statusFilter)
  ) || [];

  const filteredEvents = eventsData?.events?.filter((event: any) =>
    event.title?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'all' || event.status === statusFilter)
  ) || [];

  const filteredMerch = merchData?.merchandise?.filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'all' || item.status === statusFilter)
  ) || [];

  // Calculate summary stats
  const totalSongs = songsData?.total || 0;
  const pendingSongs = filteredSongs.filter((s: any) => s.status === 'PENDING').length;
  const totalEvents = eventsData?.total || 0;

  if (songsLoading || eventsLoading || merchLoading) {
    return <Loading size="lg" text="Loading content data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Songs</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSongs}</div>
            <p className="text-xs text-muted-foreground">{pendingSongs} pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Live events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Merchandise</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{merchData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Products available</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Management Tabs */}
      <Tabs defaultValue="songs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="songs" className="text-sm">Songs</TabsTrigger>
          <TabsTrigger value="events" className="text-sm">Events</TabsTrigger>
          <TabsTrigger value="merchandise" className="text-sm">Merchandise</TabsTrigger>
        </TabsList>

        {/* Songs Tab */}
        <TabsContent value="songs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Song Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and manage uploaded songs
              </p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="song-search">Search Songs</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="song-search"
                      placeholder="Search by title or artist..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Label htmlFor="song-status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Songs List */}
              <div className="space-y-4">
                {filteredSongs.map((song: any) => (
                  <div key={song._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{song.title || 'Untitled'}</p>
                        <p className="text-sm text-muted-foreground">
                          by {song.artistName || song.artist || 'Unknown Artist'}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Play className="w-3 h-3 mr-1" />
                            {(song.playCount || 0).toLocaleString()} plays
                          </span>
                          <span className="flex items-center">
                            <Heart className="w-3 h-3 mr-1" />
                            {(song.likeCount || 0).toLocaleString()} likes
                          </span>
                          <span>
                            {new Date(song.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {getStatusBadge(song.status)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {song.status === 'PENDING' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success hover:bg-success hover:text-white"
                            onClick={() => updateContentMutation.mutate({
                              contentType: 'songs',
                              contentId: song._id,
                              status: 'APPROVED'
                            })}
                            disabled={updateContentMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => updateContentMutation.mutate({
                              contentType: 'songs',
                              contentId: song._id,
                              status: 'REJECTED'
                            })}
                            disabled={updateContentMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        onClick={() => deleteContentMutation.mutate({
                          contentType: 'songs',
                          contentId: song._id
                        })}
                        disabled={deleteContentMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredSongs.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No songs found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage concerts, festivals, and live events
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEvents.map((event: any) => (
                  <div key={event._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{event.title || 'Untitled Event'}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.location || event.venue || 'Location TBA'} 
                          {event.city && ` • ${event.city}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.date ? new Date(event.date).toLocaleDateString() : 'Date TBA'}
                        </p>
                        {getStatusBadge(event.status || 'ACTIVE')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-semibold">₹{(event.ticketPrice || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.attendeeCount || 0} attending
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        onClick={() => deleteContentMutation.mutate({
                          contentType: 'events',
                          contentId: event._id
                        })}
                        disabled={deleteContentMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredEvents.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No events found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Merchandise Tab */}
        <TabsContent value="merchandise" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Merchandise Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage artist merchandise and products
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMerch.map((item: any) => (
                  <div key={item._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Image className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name || 'Untitled Product'}</p>
                        <p className="text-sm text-muted-foreground">
                          by {item.artistName || item.artist || 'Unknown Artist'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                        {getStatusBadge(item.status || 'ACTIVE')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-semibold">₹{(item.price || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.stock || 0} in stock
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        onClick={() => deleteContentMutation.mutate({
                          contentType: 'merchandise',
                          contentId: item._id
                        })}
                        disabled={deleteContentMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredMerch.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No merchandise found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}