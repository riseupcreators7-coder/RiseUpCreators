import { useState } from "react";
import { useLocation } from "wouter";
import { Music, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { MUSIC_GENRES } from "@/lib/constants";
import { getCreatorAuthHeaders } from "./utils";
import type { Song } from "./types";

// ---------- COMPONENT ----------
export default function SongsTab() {
  const auth = useRequireRole("artist");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showEditSongModal, setShowEditSongModal] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // ---------- QUERIES ----------
  const { data: artistSongs, isLoading: songsLoading } = useQuery({
    queryKey: ["artistSongs"],
    queryFn: () => {
      console.log("Fetching artist songs...");
      return fetch("/api/artists/songs", {
        headers: getCreatorAuthHeaders()
      }).then(res => {
        console.log("Songs API response status:", res.status);
        return res.json();
      }).then(data => {
        console.log("Songs API response data:", data);
        return data;
      });
    },
    enabled: !!auth.user,
  });

  // ---------- MUTATIONS ----------
  const deleteSongMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/songs/${id}`, {
        method: "DELETE",
        headers: getCreatorAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete song");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to update analytics
      queryClient.invalidateQueries({ queryKey: ["artistSongs"] });
      queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      toast({
        title: "Song deleted successfully",
        description: "Your song has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Song deletion failed",
        description: "Failed to delete song. Please try again.",
        variant: "destructive",
      });
    },
  });

  const editSongMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      console.log("Updating song:", id);
      const res = await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: getCreatorAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update song");
      const result = await res.json();
      console.log("Update response:", result);
      return result;
    },
    onSuccess: (updatedSong) => {
      console.log("Song update successful, invalidating cache...");
      queryClient.invalidateQueries({ queryKey: ["artistSongs"] });
      queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ["artistSongs"] });
      console.log("Cache invalidated and refetch triggered");
      toast({
        title: "Song updated successfully",
        description: "Your song changes have been saved",
      });
      setShowEditSongModal(false);
      setEditingSong(null);
    },
    onError: () => {
      toast({
        title: "Song update failed",
        description: "Failed to update song. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---------- SAFE DEFAULTS ----------
  const safeArtistSongs: Song[] = Array.isArray(artistSongs) ? artistSongs : [];

  return (
    <>
      <TabsContent value="songs">
        {songsLoading ? (
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
        ) : safeArtistSongs.length > 0 ? (
          <div className="space-y-4">
            {safeArtistSongs.map((song, index) => (
              <Card key={song._id} data-testid={`song-item-${index}`}>
                <CardContent className="p-6">
                  {/* Mobile layout - stacked */}
                  <div className="md:hidden space-y-4">
                    <div className="flex items-center space-x-4">
                      <img
                        src={
                          song.artworkUrl ||
                          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"
                        }
                        alt={song.title}
                        className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                        onClick={() => setLocation(`/songs/${song._id}`)}
                        onError={(e) =>
                          ((e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100")
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{song.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{song.genre}</p>
                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span>{song.plays?.toLocaleString() || 0} plays</span>
                            <span>•</span>
                            <span>{song.likes?.toLocaleString() || 0} likes</span>
                          </div>
                          {song.visibility === "SUBSCRIBER_ONLY" && (
                            <Badge variant="secondary" className="text-xs">
                              Subscribers Only
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSong(song);
                          setShowEditSongModal(true);
                        }}
                        data-testid={`edit-song-${index}`}
                        className="flex-1 max-w-[100px]"
                      >
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSongMutation.mutate(song._id)}
                        disabled={deleteSongMutation.isPending}
                        className="flex-1 max-w-[100px]"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>

                  {/* Desktop layout - horizontal */}
                  <div className="hidden md:flex items-center justify-between">
                    {/* Song info */}
                    <div className="flex items-center space-x-4">
                      <img
                        src={
                          song.artworkUrl ||
                          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100"
                        }
                        alt={song.title}
                        className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                        onClick={() => setLocation(`/songs/${song._id}`)}
                        onError={(e) =>
                          ((e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100")
                        }
                      />
                      <div>
                        <h3 className="font-semibold">{song.title}</h3>
                        <p className="text-sm text-muted-foreground">{song.genre}</p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {song.plays?.toLocaleString() || 0} plays
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {song.likes?.toLocaleString() || 0} likes
                          </span>
                          {song.visibility === "SUBSCRIBER_ONLY" && (
                            <Badge variant="secondary" className="text-xs">
                              Subscribers Only
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSong(song);
                          setShowEditSongModal(true);
                        }}
                        data-testid={`edit-song-${index}`}
                      >
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSongMutation.mutate(song._id)}
                        disabled={deleteSongMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
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
              <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No songs uploaded</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first song to start sharing your music with fans.
              </p>
              <Button onClick={() => setLocation("/creator?tab=upload")}>
                <Music className="w-4 h-4 mr-2" /> Upload Your First Song
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Edit Song Modal */}
      <Dialog open={showEditSongModal} onOpenChange={setShowEditSongModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Song</DialogTitle>
            <DialogDescription>Update your song details</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);

              if (editingSong) {
                // Only include data, no files for basic edit
                const songData = {
                  title: formData.get("title") as string,
                  genre: formData.get("genre") as string,
                  visibility: formData.get("visibility") as string,
                };

                const editFormData = new FormData();
                editFormData.append("data", JSON.stringify(songData));

                editSongMutation.mutate({ id: editingSong._id, formData: editFormData });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-title">Song Title</Label>
              <Input
                id="edit-title"
                name="title"
                defaultValue={editingSong?.title}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-genre">Genre</Label>
              <Select name="genre" defaultValue={editingSong?.genre}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {MUSIC_GENRES.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-visibility">Visibility</Label>
              <Select name="visibility" defaultValue={editingSong?.visibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="SUBSCRIBER_ONLY">Subscribers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditSongModal(false);
                  setEditingSong(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editSongMutation.isPending}
              >
                {editSongMutation.isPending ? "Updating..." : "Update Song"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
