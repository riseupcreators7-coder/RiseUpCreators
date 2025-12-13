import { useState, useEffect } from "react";
import { User, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Loading from "@/components/common/loading";

// ---------------- Schema Validations ----------------
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email required"),
  bio: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  instagram: z.string().optional(),
  youtube: z.string().optional(),
  x: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

// ---------------- Main Component ----------------
export default function Settings() {
  const auth = useRequireAuth();
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  // API Queries
  const { data: userSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/users/me/settings"],
    enabled: !!auth.user,
  });

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/users/me"],
    enabled: !!auth.user,
  });

  // Forms
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: auth.user?.name || "",
      email: auth.user?.email || "",
      bio: "",
      website: "",
      instagram: "",
      youtube: "",
      x: "",
    },
  });

  // Reset forms when data arrives
  useEffect(() => {
    if (userProfile) {
      const profile = userProfile as any;
      profileForm.reset({
        name: profile.name || "",
        email: profile.email || "",
        bio: "",
        website: "",
        instagram: "",
        youtube: "",
        x: "",
      });
    }

    // Use settings data for artist-specific fields if available
    if (userSettings && (userSettings as any).user) {
      const settingsUser = (userSettings as any).user;
      const profile = userProfile as any;
      profileForm.reset({
        name: settingsUser.name || profile?.name || "",
        email: settingsUser.email || profile?.email || "",
        bio: settingsUser.bio || "",
        website: settingsUser.website || "",
        instagram: settingsUser.instagram || "",
        youtube: settingsUser.youtube || "",
        x: settingsUser.x || "",
      });
    }
  }, [userProfile, userSettings, profileForm]);

  // ---------------- Profile Update Mutation ----------------
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      // Update user name/email
      const userRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({ name: data.name, email: data.email }),
      });
      if (!userRes.ok) throw new Error("Failed to update user profile");

      // Update artist profile if role=artist
      if (auth.user?.role === "artist") {
        await fetch("/api/users/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
          },
          body: JSON.stringify({
            artist: {
              bio: data.bio,
              socialLinks: {
                website: data.website,
                instagram: data.instagram,
                youtube: data.youtube,
                x: data.x,
              },
            },
          }),
        });
      }

      return userRes.json();
    },
    onSuccess: async (updatedUser) => {
      // Update auth context with latest user data
      auth.updateUser(updatedUser);
      
      // Fetch the latest complete user data to ensure consistency
      try {
        const freshUserRes = await fetch("/api/users/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
          },
        });
        if (freshUserRes.ok) {
          const freshUser = await freshUserRes.json();
          auth.updateUser(freshUser);
        }
      } catch (error) {
        // Failed to fetch fresh user data
      }
      
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists/profile"] });
      
      toast({ title: "Profile updated", description: "Changes saved successfully" });
    },
    onError: () => toast({ title: "Update failed", description: "Try again later", variant: "destructive" }),
  });

  // ---------------- Password Change Mutation ----------------
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Password change failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Password changed successfully" });
    },
    onError: () => toast({ title: "Error", description: "Current password invalid", variant: "destructive" }),
  });

  // ---------------- Avatar Upload Mutation ----------------
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: async (data) => {
      // Update auth context with new avatar URL immediately
      if (auth.user) {
        auth.updateUser({ ...auth.user, avatarUrl: data.avatarUrl });
      }
      
      // Fetch the latest complete user data to ensure consistency
      try {
        const freshUserRes = await fetch("/api/users/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
          },
        });
        if (freshUserRes.ok) {
          const freshUser = await freshUserRes.json();
          auth.updateUser(freshUser);
        }
      } catch (error) {
        // Failed to fetch fresh user data
      }
      
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists/profile"] });
      
      toast({ title: "Avatar updated", description: "Profile picture changed" });
      setIsUploading(false);
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      setIsUploading(false);
    },
  });

  // ---------------- Delete Account Mutation ----------------
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      // Clear all auth-related data and queries
      queryClient.clear();
      auth.logout();
      toast({ title: "Account deleted", description: "Your account has been removed. Thank you for being part of Rise Up Creators!" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete account", variant: "destructive" }),
  });

  // ---------------- Handlers ----------------
  const handleProfileSubmit = (data: ProfileForm) => updateProfileMutation.mutate(data);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Select an image", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    uploadAvatarMutation.mutate(file);
  };

  if (auth.isLoading || settingsLoading || profileLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading settings..." />
      </div>
    );
  }

  if (!auth.user) return null;

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container-custom py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your profile information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Profile Information
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your public profile information
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex items-center space-x-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage
                    src={
                      (userSettings as any)?.user?.avatarUrl ||
                      auth.user?.avatarUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user.email}`
                    }
                  />
                  <AvatarFallback className="text-2xl">
                    {auth.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button
                    variant="outline"
                    disabled={isUploading}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                    type="button"
                  >
                    {isUploading ? <Loading size="sm" /> : <><Upload className="w-4 h-4 mr-2" /> Change Photo</>}
                  </Button>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF. Max 5MB.</p>
                </div>
              </div>

              {/* Name + Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...profileForm.register("name")} />
                  {profileForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...profileForm.register("email")} />
                  {profileForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{profileForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell us about yourself..." {...profileForm.register("bio")} />
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" {...profileForm.register("website")} />
                    {profileForm.formState.errors.website && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.website.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input id="instagram" placeholder="@username" {...profileForm.register("instagram")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube</Label>
                    <Input id="youtube" placeholder="Channel URL" {...profileForm.register("youtube")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="x">X (Twitter)</Label>
                    <Input id="x" placeholder="@username" {...profileForm.register("x")} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="gradient-primary text-white" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? <Loading size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
