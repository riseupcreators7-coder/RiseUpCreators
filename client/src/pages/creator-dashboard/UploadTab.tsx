import { useState } from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import { MUSIC_GENRES } from "@/lib/constants";
import { getCreatorAuthHeaders } from "./utils";

// ---------- COMPONENT ----------
export default function UploadTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Check if user can upload - only ARTIST plan users can upload
  const canUpload = auth.user?.plan?.type === "ARTIST";
  const userPlan = auth.user?.plan?.type || "FREE";

  // Upload Song Mutation
  const uploadSongMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/songs/upload", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Song uploaded successfully" });
      setIsUploading(false);
      
      // Small delay to ensure database write is complete, then refresh data
      setTimeout(() => {
        // Invalidate relevant queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ["artistSongs"] });
        queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
        queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
        
        // Force refetch of artist songs
        queryClient.refetchQueries({ queryKey: ["artistSongs"] });
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Song Upload Handler
  const handleSongUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const audioFile = formData.get("audio") as File;
    const artworkFile = formData.get("artwork") as File;

    if (!audioFile) {
      toast({
        title: "Missing audio file",
        description: "Please select an audio file",
        variant: "destructive",
      });
      return;
    }

    // Prepare FormData for upload (match backend expectations)
    const uploadFormData = new FormData();
    uploadFormData.append("audio", audioFile);
    if (artworkFile) {
      uploadFormData.append("artwork", artworkFile);
    }
    
    // Append form fields directly (not as JSON)
    uploadFormData.append("title", formData.get("title") as string);
    uploadFormData.append("genre", formData.get("genre") as string);
    uploadFormData.append("visibility", (formData.get("visibility") as string) || "PUBLIC");
    uploadFormData.append("duration", "0"); // Will be calculated by backend

    setIsUploading(true);
    uploadSongMutation.mutate(uploadFormData);
    form.reset();
  };

  return (
    <TabsContent value="upload">
      <Card>
        <CardHeader>
          <CardTitle>Upload New Song</CardTitle>
          <p className="text-sm text-muted-foreground">
            Share your music with the world. Supported formats: MP3, WAV
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSongUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Song Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter song title"
                  required
                />
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <Label htmlFor="genre">Genre *</Label>
                <Select name="genre" required>
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
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select name="visibility" defaultValue="PUBLIC">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="SUBSCRIBER_ONLY">Subscribers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Files */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="audio">Audio File *</Label>
                <Input id="audio" name="audio" type="file" accept="audio/*" required />
                <p className="text-xs text-muted-foreground">Max size: 50MB</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="artwork">Artwork *</Label>
                <Input id="artwork" name="artwork" type="file" accept="image/*" required />
                <p className="text-xs text-muted-foreground">Recommended: 800x800px</p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary hover:opacity-90"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loading size="sm" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload Song
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
