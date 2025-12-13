import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Search, Users, UserCheck, UserX, CheckCircle, XCircle, Clock, Shield, Edit, Ban } from "lucide-react";
import Loading from "@/components/common/loading";
import BanUserDialog from "@/components/admin/BanUserDialog";

export default function AdminUserManagementUnified() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [banDialogUser, setBanDialogUser] = useState<any>(null);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["/api/admin/users", roleFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?role=${roleFilter}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch pending artists
  const { data: pendingArtists, isLoading: artistsLoading, error: artistsError } = useQuery({
    queryKey: ["/api/admin/pending-artists"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pending-artists", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch pending artists: ${response.status}`);
      }
      return response.json();
    },
  });

  // Artist verification mutation
  const verifyArtistMutation = useMutation({
    mutationFn: async ({ artistId, approved, reason }: { artistId: string; approved: boolean; reason?: string }) => {
      const response = await fetch(`/api/admin/verify-artist/${artistId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ approved, reason })
      });
      if (!response.ok) throw new Error('Failed to verify artist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Artist verification updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update artist verification",
        variant: "destructive"
      });
    }
  });

  // User action mutations
  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason, duration }: { userId: string; reason: string; duration?: number }) => {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ reason, duration })
      });
      if (!response.ok) throw new Error('Failed to ban user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User banned successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to ban user",
        variant: "destructive"
      });
    }
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to unban user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User unbanned successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unban user",
        variant: "destructive"
      });
    }
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole, reason }: { userId: string; newRole: string; reason: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/change-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ newRole, reason })
      });
      if (!response.ok) throw new Error('Failed to change role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User role changed successfully" });
    },
  });

  const filteredUsers = usersData?.users?.filter((user: any) =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleBanUser = (user: any) => {
    setBanDialogUser(user);
    setIsBanDialogOpen(true);
  };

  const handleCloseBanDialog = () => {
    setBanDialogUser(null);
    setIsBanDialogOpen(false);
  };

  const handleBanSubmit = async (userId: string, reason: string, duration?: number) => {
    await banUserMutation.mutateAsync({ userId, reason, duration });
  };

  const handleUnbanSubmit = async (userId: string) => {
    await unbanUserMutation.mutateAsync(userId);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'artist':
        return <Badge variant="default">Artist</Badge>;
      case 'fan':
        return <Badge variant="secondary">Fan</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (user: any) => {
    if (user.banned) {
      return <Badge variant="destructive">Banned</Badge>;
    }
    if (user.role === 'artist' && !user.artist?.verified) {
      return <Badge variant="secondary">Pending Verification</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  if (usersLoading || artistsLoading) {
    return <Loading size="lg" text="Loading user data..." />;
  }

  if (usersError || artistsError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading data</div>
        <div className="text-sm text-muted-foreground">
          {usersError?.message || artistsError?.message || "Unknown error occurred"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All platform users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Artists</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingArtists?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Artists</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredUsers.filter((u: any) => u.role === 'artist' && u.artist?.verified).length}
            </div>
            <p className="text-xs text-muted-foreground">Verified artists</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredUsers.filter((u: any) => u.role === 'fan').length}
            </div>
            <p className="text-xs text-muted-foreground">Platform fans</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management Tabs */}
      <Tabs defaultValue="all-users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-users">All Users</TabsTrigger>
          <TabsTrigger value="artist-verification">Artist Verification</TabsTrigger>
        </TabsList>

        {/* All Users Tab */}
        <TabsContent value="all-users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage all platform users, roles, and permissions
              </p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Search Users</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Label htmlFor="role-filter">Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="fan">Fans</SelectItem>
                      <SelectItem value="artist">Artists</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-4">
                {filteredUsers.map((user: any) => (
                  <div key={user._id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg space-y-3 md:space-y-0">
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user._id}`} />
                        <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{user.name || 'Unknown User'}</h3>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {getRoleBadge(user.role)}
                          {getStatusBadge(user)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-start md:justify-end space-x-2">
                      {user.banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleBanUser(user)}
                          disabled={banUserMutation.isPending || unbanUserMutation.isPending}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handleBanUser(user)}
                          disabled={banUserMutation.isPending || unbanUserMutation.isPending}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Ban
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeRoleMutation.mutate({
                          userId: user._id,
                          newRole: user.role === 'fan' ? 'artist' : 'fan',
                          reason: "Role change requested"
                        })}
                        disabled={changeRoleMutation.isPending}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Change Role
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Artist Verification Tab */}
        <TabsContent value="artist-verification" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Artist Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and approve artist applications to allow them to publish content
              </p>
            </CardHeader>
            <CardContent>
              {pendingArtists && pendingArtists.length > 0 ? (
                <div className="space-y-4">
                  {pendingArtists.map((artist: any, index: number) => (
                    <div
                      key={artist._id}
                      className="p-6 border rounded-lg"
                      data-testid={`pending-artist-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.userId || 'artist'}`} />
                            <AvatarFallback>{artist.name?.charAt(0) || 'A'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{artist.name || 'Unknown Artist'}</h3>
                            <p className="text-sm text-muted-foreground">{artist.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Applied on {new Date(artist.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success hover:bg-success hover:text-white"
                            onClick={() => verifyArtistMutation.mutate({
                              artistId: artist._id,
                              approved: true
                            })}
                            disabled={verifyArtistMutation.isPending}
                            data-testid="approve-artist"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => verifyArtistMutation.mutate({
                              artistId: artist._id,
                              approved: false,
                              reason: "Application needs more information"
                            })}
                            disabled={verifyArtistMutation.isPending}
                            data-testid="reject-artist"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No pending artist applications at the moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ban/Unban Dialog */}
      <BanUserDialog
        user={banDialogUser}
        isOpen={isBanDialogOpen}
        onClose={handleCloseBanDialog}
        onBan={handleBanSubmit}
        onUnban={handleUnbanSubmit}
        isLoading={banUserMutation.isPending || unbanUserMutation.isPending}
      />
    </div>
  );
}