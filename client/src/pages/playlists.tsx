import { useState } from "react";
import { Music, Play, Plus, MoreHorizontal, Trash2, Edit3, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { useLocation } from "wouter";

export default function Playlists() {
  const auth = useRequireAuth();
  const { play, addToQueue } = useMusicPlayer();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingPlaylist, setEditingPlaylist] = useState<any>(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");

  const { data: playlists, isLoading } = useQuery({
    queryKey: ["/api/playlists/mine"],
    queryFn: async () => {
      const response = await fetch("/api/playlists/mine", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch playlists");
      return response.json();
    },
    enabled: !!auth.user,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ name, songs: [] })
      });
      if (!response.ok) throw new Error("Failed to create playlist");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Playlist created",
        description: "Your new playlist has been created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/mine"] });
      setShowCreateModal(false);
      setNewPlaylistName("");
    }
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async ({ playlistId, name }: { playlistId: string, name: string }) => {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Failed to update playlist");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Playlist updated",
        description: "Playlist name has been updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/mine"] });
      setShowEditModal(false);
      setEditingPlaylist(null);
      setEditPlaylistName("");
    }
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to delete playlist");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Playlist deleted",
        description: "Your playlist has been deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/mine"] });
    }
  });

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylistMutation.mutate(newPlaylistName.trim());
    }
  };

  const handleEditPlaylist = (playlist: any) => {
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name);
    setShowEditModal(true);
  };

  const handleUpdatePlaylist = () => {
    if (editingPlaylist && editPlaylistName.trim()) {
      updatePlaylistMutation.mutate({
        playlistId: editingPlaylist._id,
        name: editPlaylistName.trim()
      });
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylistMutation.mutate(playlistId);
    }
  };

  const handlePlayPlaylist = (playlist: any) => {
    if (playlist.songs && playlist.songs.length > 0) {
      play(playlist.songs[0]);
      if (playlist.songs.length > 1) {
        addToQueue(playlist.songs.slice(1));
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!auth.user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading your playlists..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container-custom py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Playlists</h1>
            <p className="text-muted-foreground">Create and manage your music collections</p>
          </div>

          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/80 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="playlist-name">Playlist Name</Label>
                  <Input
                    id="playlist-name"
                    placeholder="Enter playlist name..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <Button 
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                  className="w-full"
                >
                  {createPlaylistMutation.isPending ? <Loading size="sm" /> : "Create Playlist"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Playlists Grid */}
        {playlists && playlists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {playlists.map((playlist: any) => (
              <Card key={playlist._id} className="group hover:shadow-lg transition-all duration-300">
                <CardContent className="p-0">
                  {/* Playlist Cover */}
                  <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg overflow-hidden">
                    {playlist.songs && playlist.songs.length > 0 ? (
                      <div className="grid grid-cols-2 gap-0.5 h-full">
                        {playlist.songs.slice(0, 4).map((song: any, index: number) => (
                          <img
                            key={index}
                            src={song.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200"}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ))}
                        {playlist.songs.length < 4 && (
                          <>
                            {[...Array(4 - playlist.songs.length)].map((_, index) => (
                              <div key={`empty-${index}`} className="w-full h-full bg-muted flex items-center justify-center">
                                <Music className="w-8 h-8 text-muted-foreground opacity-50" />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-16 h-16 text-muted-foreground opacity-50" />
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                      <Button
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary hover:bg-primary/80 text-white rounded-full"
                        onClick={() => handlePlayPlaylist(playlist)}
                        disabled={!playlist.songs || playlist.songs.length === 0}
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Playlist Actions */}
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 hover:bg-black/70 text-white"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditPlaylist(playlist)}>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeletePlaylist(playlist._id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Playlist Info */}
                  <div className="p-4">
                    <h3 
                      className="font-semibold text-lg mb-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/playlist/${playlist._id}`)}
                    >
                      {playlist.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {playlist.songs?.length || 0} songs
                      {playlist.songs && playlist.songs.length > 0 && (
                        <>
                          {" • "}
                          {formatDuration(
                            playlist.songs.reduce((total: number, song: any) => total + (song.durationSec || 0), 0)
                          )}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(playlist.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent>
              <Music className="w-20 h-20 text-muted-foreground mx-auto mb-6 opacity-50" />
              <h3 className="text-xl font-semibold mb-3">No playlists yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first playlist to organize your favorite songs and discover new music.
              </p>
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/80 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Playlist
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Playlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="playlist-name">Playlist Name</Label>
                      <Input
                        id="playlist-name"
                        placeholder="Enter playlist name..."
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button 
                      onClick={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                      className="w-full"
                    >
                      {createPlaylistMutation.isPending ? <Loading size="sm" /> : "Create Playlist"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Edit Playlist Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-playlist-name">Playlist Name</Label>
                <Input
                  id="edit-playlist-name"
                  placeholder="Enter new playlist name..."
                  value={editPlaylistName}
                  onChange={(e) => setEditPlaylistName(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdatePlaylist}
                  disabled={!editPlaylistName.trim() || updatePlaylistMutation.isPending}
                  className="flex-1"
                >
                  {updatePlaylistMutation.isPending ? <Loading size="sm" /> : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}