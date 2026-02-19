import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Shield, CheckCircle, AlertCircle, DollarSign, Youtube, RefreshCw, Clock } from "lucide-react";
import type { ArtistProfile } from "./types";
import { createSafeArtistProfile, getCreatorAuthHeaders } from "./utils";
import { useState, useEffect } from "react";

interface BankDetails {
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  bankName?: string;
  phoneNumber?: string;
  panNumber?: string;
  aadharNumber?: string;
  verified?: boolean;
}

interface SubscriptionSettings {
  monthlyPrice: number;
  yearlyPrice: number;
  benefits: string[];
  isActive: boolean;
}

interface YouTubeChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
  description: string;
  customUrl: string;
  country: string;
  verificationStatus: "pending" | "verified" | "rejected";
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  lastSyncedAt: string;
}

// ---------- COMPONENT ----------
export default function SettingsTab() {
  const auth = useRequireRole("artist");
  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    bankName: "",
    phoneNumber: "",
    panNumber: "",
    aadharNumber: ""
  });
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>({
    monthlyPrice: 99,
    yearlyPrice: 999,
    benefits: ["Exclusive content", "Early access", "Direct messaging"],
    isActive: true
  });

  // YouTube verification state
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState("");

  // Meta connection state
  const [metaStatus, setMetaStatus] = useState<any>(null);

  // Artist profile form state
  const [artistProfileData, setArtistProfileData] = useState({
    bio: "",
    instagram: "",
    youtube: "",
    website: "",
    x: ""
  });

  const queryClient = useQueryClient();

  // ---------- QUERIES ----------
  const { data: artistProfile } = useQuery({
    queryKey: ["artistProfile"],
    queryFn: () => fetch("/api/artists/profile", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
  });

  // Fetch current bank details
  const { data: bankDetails, isLoading: bankDetailsLoading } = useQuery<BankDetails>({
    queryKey: ["/api/users/me/bank-details"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/bank-details", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch bank details");
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Fetch current subscription settings
  const { data: currentSubscriptionSettings, isLoading: subscriptionSettingsLoading } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/artists/subscription-settings"],
    queryFn: async () => {
      const response = await fetch("/api/artists/subscription-settings", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) {
        if (response.status === 404) {
          // Return default settings if not found
          return {
            monthlyPrice: 9.99,
            yearlyPrice: 99.99,
            benefits: []
          };
        }
        throw new Error("Failed to fetch subscription settings");
      }
      return response.json();
    },
    enabled: !!auth.user,
    retry: false, // Don't retry 404s
  });

  // Fetch YouTube channel data
  const { data: youtubeData, isLoading: youtubeLoading, refetch: refetchYoutubeData } = useQuery<{ success: boolean; hasChannel: boolean; data?: YouTubeChannel }>({
    queryKey: ["/api/creators/youtube"],
    queryFn: async () => {
      const response = await fetch("/api/creators/youtube", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, hasChannel: false };
        }
        throw new Error("Failed to fetch YouTube data");
      }
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Fetch Meta connection status
  const { data: metaStatusData, refetch: refetchMetaStatus } = useQuery({
    queryKey: ["/api/creators/meta/status"],
    queryFn: async () => {
      const response = await fetch("/api/creators/meta/status", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch Meta status");
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Save subscription settings mutation
  const saveSubscriptionSettingsMutation = useMutation({
    mutationFn: async (settings: SubscriptionSettings) => {
      const response = await fetch("/api/artists/subscription-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error("Failed to save subscription settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists/subscription-settings"] });
      // Invalidate artist profile cache so fans see updated prices
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${auth.user?._id}`] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      toast({
        title: "Success",
        description: "Subscription settings saved successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save subscription settings",
        variant: "destructive"
      });
    }
  });

  // Save artist profile mutation
  const saveArtistProfileMutation = useMutation({
    mutationFn: async (profileData: typeof artistProfileData) => {
      const response = await fetch("/api/artists/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify({
          bio: profileData.bio,
          socialLinks: {
            instagram: profileData.instagram,
            youtube: profileData.youtube,
            website: profileData.website,
            x: profileData.x
          }
        })
      });
      if (!response.ok) throw new Error("Failed to save artist profile");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/settings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${auth.user?._id}`] });
      toast({
        title: "Success",
        description: "Artist profile saved successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save artist profile",
        variant: "destructive"
      });
    }
  });
  const saveBankDetailsMutation = useMutation({
    mutationFn: async (details: typeof bankFormData) => {
      const response = await fetch("/api/users/me/bank-details", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify(details)
      });
      if (!response.ok) throw new Error("Failed to save bank details");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bank-details"] });
      toast({
        title: "Success",
        description: "Bank details saved successfully"
      });
      setIsBankFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save bank details",
        variant: "destructive"
      });
    }
  });

  // YouTube verification mutation (submit for admin approval)
  const verifyYouTubeMutation = useMutation({
    mutationFn: async (channelUrl: string) => {
      const response = await fetch("/api/creators/youtube/submit-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify({ channelUrl })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit verification request");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/creators/youtube"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      refetchYoutubeData();
      setYoutubeChannelUrl("");
      toast({
        title: "Submitted for Verification",
        description: data.message || "Your YouTube channel has been submitted for admin review. You'll be notified within 24-48 hours."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit verification request",
        variant: "destructive"
      });
    }
  });

  // YouTube refresh mutation
  const refreshYouTubeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/creators/youtube/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to refresh YouTube data");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creators/youtube"] });
      refetchYoutubeData();
      toast({
        title: "Success",
        description: "YouTube data refreshed successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh YouTube data",
        variant: "destructive"
      });
    }
  });

  // Update subscription settings when data is loaded
  useEffect(() => {
    if (currentSubscriptionSettings) {
      setSubscriptionSettings(prev => ({ ...prev, ...currentSubscriptionSettings }));
    }
  }, [currentSubscriptionSettings]);

  // Update artist profile form when data is loaded
  useEffect(() => {
    if (artistProfile) {
      const safeProfile = createSafeArtistProfile(artistProfile, auth.user);
      setArtistProfileData({
        bio: safeProfile.bio,
        instagram: safeProfile.socialLinks.instagram,
        youtube: safeProfile.socialLinks.youtube,
        website: safeProfile.socialLinks.website,
        x: safeProfile.socialLinks.x
      });
    }
  }, [artistProfile, auth.user]);

  const handleSaveSubscriptionSettings = () => {
    saveSubscriptionSettingsMutation.mutate(subscriptionSettings);
  };

  const handleSaveArtistProfile = () => {
    saveArtistProfileMutation.mutate(artistProfileData);
  };

  const handleVerifyYouTube = () => {
    if (!youtubeChannelUrl || !youtubeChannelUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a YouTube channel URL",
        variant: "destructive"
      });
      return;
    }
    verifyYouTubeMutation.mutate(youtubeChannelUrl);
  };

  const handleRefreshYouTube = () => {
    refreshYouTubeMutation.mutate();
  };

  const handleBankFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!bankFormData.accountNumber || !bankFormData.ifscCode || !bankFormData.accountHolderName ||
        !bankFormData.phoneNumber || !bankFormData.panNumber || !bankFormData.aadharNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankFormData.ifscCode)) {
      toast({
        title: "Invalid IFSC Code",
        description: "Please enter a valid IFSC code",
        variant: "destructive"
      });
      return;
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(bankFormData.phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive"
      });
      return;
    }

    // Validate PAN number format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(bankFormData.panNumber)) {
      toast({
        title: "Invalid PAN Number",
        description: "Please enter a valid PAN number (e.g., ABCDE1234F)",
        variant: "destructive"
      });
      return;
    }

    // Validate Aadhar number format
    const aadharRegex = /^[0-9]{12}$/;
    if (!aadharRegex.test(bankFormData.aadharNumber)) {
      toast({
        title: "Invalid Aadhar Number",
        description: "Please enter a valid 12-digit Aadhar number",
        variant: "destructive"
      });
      return;
    }

    saveBankDetailsMutation.mutate(bankFormData);
  };

  const handleEditBankDetails = () => {
    if (bankDetails) {
      setBankFormData({
        accountNumber: bankDetails.accountNumber || "",
        ifscCode: bankDetails.ifscCode || "",
        accountHolderName: bankDetails.accountHolderName || "",
        bankName: bankDetails.bankName || "",
        phoneNumber: bankDetails.phoneNumber || "",
        panNumber: bankDetails.panNumber || "",
        aadharNumber: bankDetails.aadharNumber || ""
      });
    }
    setIsBankFormOpen(true);
  };

  return (
    <TabsContent value="settings">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Artist Profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your public artist information
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={artistProfileData.bio}
                onChange={(e) => setArtistProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell fans about yourself..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={artistProfileData.instagram}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="https://instagram.com/username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={artistProfileData.youtube}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, youtube: e.target.value }))}
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={artistProfileData.website}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://yourwebsite.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="x">X (Twitter)</Label>
                <Input
                  id="x"
                  value={artistProfileData.x}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, x: e.target.value }))}
                  placeholder="https://x.com/username"
                />
              </div>
            </div>

            <Button 
              className="bg-primary hover:bg-primary/80"
              onClick={handleSaveArtistProfile}
              disabled={saveArtistProfileMutation.isPending}
            >
              {saveArtistProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* YouTube Channel Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-600" />
              YouTube Channel
              {youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "verified" && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
              {youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "pending" && (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Review
                </Badge>
              )}
              {youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "rejected" && (
                <Badge variant="destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Rejected
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Connect your YouTube channel to showcase your content and statistics
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {youtubeLoading ? (
              <div className="text-center py-4">Loading YouTube data...</div>
            ) : youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "verified" ? (
              // Display verified channel data
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  {youtubeData.data.thumbnails?.medium && (
                    <img 
                      src={youtubeData.data.thumbnails.medium} 
                      alt={youtubeData.data.channelName}
                      className="w-20 h-20 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{youtubeData.data.channelName}</h3>
                    {youtubeData.data.customUrl && (
                      <p className="text-sm text-muted-foreground">@{youtubeData.data.customUrl}</p>
                    )}
                    {youtubeData.data.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {youtubeData.data.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Subscribers</p>
                    <p className="text-2xl font-bold">
                      {youtubeData.data.subscriberCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Videos</p>
                    <p className="text-2xl font-bold">
                      {youtubeData.data.videoCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Views</p>
                    <p className="text-2xl font-bold">
                      {youtubeData.data.viewCount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-muted-foreground">
                    Last synced: {new Date(youtubeData.data.lastSyncedAt).toLocaleDateString()}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefreshYouTube}
                    disabled={refreshYouTubeMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshYouTubeMutation.isPending ? 'animate-spin' : ''}`} />
                    {refreshYouTubeMutation.isPending ? "Refreshing..." : "Refresh Data"}
                  </Button>
                </div>
              </div>
            ) : youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "pending" ? (
              // Pending verification status
              <div className="space-y-4">
                <div className="text-center py-8">
                  <Clock className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Verification Pending</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your YouTube channel verification is under review by our admin team.
                  </p>
                  <div className="p-4 bg-muted/50 rounded-lg text-left max-w-md mx-auto">
                    <p className="text-sm font-medium mb-2">Channel Details:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>Channel:</strong> {youtubeData.data.channelName}</p>
                      <p><strong>Subscribers:</strong> {youtubeData.data.subscriberCount.toLocaleString()}</p>
                      <p><strong>Submitted:</strong> {new Date(youtubeData.data.submittedAt || '').toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    You'll receive an email notification once your channel is reviewed (typically within 24-48 hours)
                  </p>
                </div>
              </div>
            ) : youtubeData?.hasChannel && youtubeData.data && youtubeData.data.verificationStatus === "rejected" ? (
              // Rejected verification status
              <div className="space-y-4">
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Verification Rejected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your YouTube channel verification was not approved.
                  </p>
                  {youtubeData.data.rejectionReason && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-left max-w-md mx-auto mb-4">
                      <p className="text-sm font-medium text-red-900 mb-1">Reason:</p>
                      <p className="text-sm text-red-700">{youtubeData.data.rejectionReason}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mb-4">
                    You can submit a different YouTube channel for verification
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setYoutubeChannelUrl("");
                      // Clear rejected status to show form again
                      queryClient.setQueryData(["/api/creators/youtube"], { success: false, hasChannel: false });
                    }}
                  >
                    Submit Different Channel
                  </Button>
                </div>
              </div>
            ) : (
              // Verification form
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Youtube className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your YouTube Channel</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verify your YouTube channel to display your subscriber count, videos, and views
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtubeChannelUrl">YouTube Channel URL</Label>
                  <Input
                    id="youtubeChannelUrl"
                    value={youtubeChannelUrl}
                    onChange={(e) => setYoutubeChannelUrl(e.target.value)}
                    placeholder="https://youtube.com/@yourchannel or https://youtube.com/channel/UC..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your YouTube channel URL. Supported formats: @handle, /channel/ID, /c/custom, /user/username
                  </p>
                </div>

                <Button 
                  onClick={handleVerifyYouTube}
                  disabled={verifyYouTubeMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {verifyYouTubeMutation.isPending ? "Submitting..." : "Submit for Verification"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Your channel will be reviewed by our admin team within 24-48 hours
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta Platforms (Facebook & Instagram) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Meta Platforms
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Connect your Facebook Page and Instagram Business account
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Show success message if just connected */}
            {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success') === 'meta_connected' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <p className="font-medium">Successfully connected to Meta!</p>
                </div>
              </div>
            )}

            {/* Show Facebook Profile if connected */}
            {metaStatusData?.profile?.connected && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-4">
                  {metaStatusData.profile.profilePicture && (
                    <img 
                      src={metaStatusData.profile.profilePicture} 
                      alt={metaStatusData.profile.name}
                      className="w-16 h-16 rounded-full border-2 border-blue-300"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-blue-900">{metaStatusData.profile.name}</h4>
                      <Badge variant="default" className="bg-blue-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    </div>
                    {metaStatusData.profile.email && (
                      <p className="text-sm text-blue-700">{metaStatusData.profile.email}</p>
                    )}
                    {metaStatusData.facebook?.connected && (
                      <p className="text-xs text-blue-600 mt-1">
                        Page: {metaStatusData.facebook.pageName} 
                        {metaStatusData.facebook.verificationStatus === 'verified' && ' ✓'}
                        {metaStatusData.facebook.verificationStatus === 'pending' && ' (Pending Review)'}
                      </p>
                    )}
                    {metaStatusData.instagram?.connected && (
                      <p className="text-xs text-blue-600">
                        Instagram: @{metaStatusData.instagram.username}
                        {metaStatusData.instagram.verificationStatus === 'verified' && ' ✓'}
                        {metaStatusData.instagram.verificationStatus === 'pending' && ' (Pending Review)'}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchMetaStatus()}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Facebook Connection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold">Facebook Page</h4>
                    <p className="text-sm text-muted-foreground">
                      {metaStatusData?.facebook?.connected 
                        ? `Connected: ${metaStatusData.facebook.pageName}` 
                        : 'Connect your Facebook Page'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/auth/meta/facebook/init", {
                        headers: getCreatorAuthHeaders()
                      });
                      const data = await response.json();
                      if (data.authUrl) {
                        window.location.href = data.authUrl;
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to initiate Facebook connection",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  {metaStatusData?.profile?.connected ? 'Reconnect' : 'Connect Facebook'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {metaStatusData?.profile?.connected && !metaStatusData?.facebook?.connected
                  ? 'Profile connected! To display page content, you need to manage a Facebook Page.'
                  : 'Connect your Facebook Page to display posts, followers, and engagement metrics'}
              </p>
            </div>

            {/* Instagram Connection */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold">Instagram Business</h4>
                    <p className="text-sm text-muted-foreground">Auto-connects via Facebook</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Requires Facebook
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Instagram Business accounts automatically connect when you link your Facebook Page. Make sure your Instagram is linked to your Facebook Page.
              </p>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-blue-900">Connection Steps:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Click "Connect Facebook" to authenticate</li>
                    <li>Your profile will be connected immediately</li>
                    <li>If you manage a Facebook Page, it will also be connected</li>
                    <li>Instagram Business accounts auto-connect if linked to your Page</li>
                  </ul>
                  {!metaStatusData?.facebook?.connected && metaStatusData?.profile?.connected && (
                    <p className="text-blue-900 font-medium mt-2">
                      💡 No Facebook Page found. Create or get admin access to a Page to display content.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Subscription Pricing
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Set your subscription price and manage fan support tiers
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthly-price">Monthly Price (₹) *</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min="1"
                  max="10000"
                  value={subscriptionSettings.monthlyPrice}
                  onChange={(e) => setSubscriptionSettings(prev => ({ 
                    ...prev, 
                    monthlyPrice: parseInt(e.target.value) || 99 
                  }))}
                  placeholder="Enter monthly subscription price"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Price fans will pay monthly to support you
                </p>
              </div>

              <div>
                <Label htmlFor="yearly-price">Yearly Price (₹) *</Label>
                <Input
                  id="yearly-price"
                  type="number"
                  min="1"
                  max="100000"
                  value={subscriptionSettings.yearlyPrice}
                  onChange={(e) => setSubscriptionSettings(prev => ({ 
                    ...prev, 
                    yearlyPrice: parseInt(e.target.value) || 999 
                  }))}
                  placeholder="Enter yearly subscription price"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Discounted price for yearly subscribers
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="subscription-active">Enable Subscriptions</Label>
                <p className="text-sm text-muted-foreground">
                  Allow fans to subscribe to your content
                </p>
              </div>
              <Switch
                id="subscription-active"
                checked={subscriptionSettings.isActive}
                onCheckedChange={(checked) => setSubscriptionSettings(prev => ({ 
                  ...prev, 
                  isActive: checked 
                }))}
              />
            </div>

            <div>
              <Label htmlFor="tier-benefits">Benefits (one per line)</Label>
              <Textarea
                id="tier-benefits"
                rows={4}
                value={subscriptionSettings.benefits?.join('\n') || ''}
                onChange={(e) => setSubscriptionSettings(prev => ({ 
                  ...prev, 
                  benefits: e.target.value.split('\n').filter(b => b.trim()) 
                }))}
                placeholder="Exclusive content&#10;Early access to music&#10;Direct messaging&#10;Monthly live sessions"
              />
              <p className="text-sm text-muted-foreground mt-1">
                What benefits will subscribers get?
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Pricing Preview</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Monthly subscriber pays:</span>
                  <span className="font-medium">₹{subscriptionSettings.monthlyPrice}/month</span>
                </div>
                <div className="flex justify-between">
                  <span>Yearly subscriber pays:</span>
                  <span className="font-medium">₹{subscriptionSettings.yearlyPrice}/year</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (10%):</span>
                  <span>₹{Math.round(subscriptionSettings.monthlyPrice * 0.1)}/month</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>You receive (monthly):</span>
                  <span className="text-green-600">₹{Math.round(subscriptionSettings.monthlyPrice * 0.9)}/month</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>You receive (yearly):</span>
                  <span className="text-green-600">₹{Math.round(subscriptionSettings.yearlyPrice * 0.9)}/year</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveSubscriptionSettings}
              disabled={saveSubscriptionSettingsMutation.isPending}
              className="bg-primary hover:bg-primary/80"
            >
              {saveSubscriptionSettingsMutation.isPending ? "Saving..." : "Save Subscription Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Bank Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Bank Account Details
              {bankDetails?.verified ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : bankDetails?.accountNumber ? (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Pending Verification
                </Badge>
              ) : (
                <Badge variant="destructive">Not Added</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add your bank account details to receive payouts from your earnings
            </p>
          </CardHeader>
          <CardContent>
            {bankDetailsLoading ? (
              <div>Loading bank details...</div>
            ) : bankDetails && bankDetails.accountNumber ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Account Holder</Label>
                    <p className="font-medium">{bankDetails.accountHolderName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Bank Name</Label>
                    <p className="font-medium">{bankDetails.bankName || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Account Number</Label>
                    <p className="font-mono">
                      {bankDetails.accountNumber?.replace(/\d(?=\d{4})/g, "*") || "****"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">IFSC Code</Label>
                    <p className="font-mono">{bankDetails.ifscCode}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                    <p className="font-mono">{bankDetails.phoneNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PAN Number</Label>
                    <p className="font-mono">{bankDetails.panNumber?.replace(/(?<=^.{2}).*(?=.{2}$)/g, "*****") || "********"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Aadhar Number</Label>
                    <p className="font-mono">{bankDetails.aadharNumber?.replace(/\d(?=\d{4})/g, "*") || "************"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
                  <Button onClick={handleEditBankDetails} variant="outline">
                    Edit Details
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    Your bank details are encrypted and secure
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Add Bank Details</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your bank account details to receive payouts from your earnings
                </p>
                <Button onClick={() => setIsBankFormOpen(true)}>
                  Add Bank Details
                </Button>
              </div>
            )}

            {/* Bank Details Form Dialog */}
            <Dialog open={isBankFormOpen} onOpenChange={setIsBankFormOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Bank Account Details</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleBankFormSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input
                      id="accountHolderName"
                      value={bankFormData.accountHolderName}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                      placeholder="Enter account holder name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                      placeholder="Enter account number"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="ifscCode">IFSC Code *</Label>
                    <Input
                      id="ifscCode"
                      value={bankFormData.ifscCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="Enter IFSC code (e.g., SBIN0001234)"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bankName">Bank Name (Optional)</Label>
                    <Input
                      id="bankName"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      value={bankFormData.phoneNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, phoneNumber: e.target.value })}
                      placeholder="Enter phone number"
                      required
                      type="tel"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="panNumber">PAN Number *</Label>
                    <Input
                      id="panNumber"
                      value={bankFormData.panNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="Enter PAN number"
                      required
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                    <Input
                      id="aadharNumber"
                      value={bankFormData.aadharNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, aadharNumber: e.target.value })}
                      placeholder="Enter Aadhar number"
                      required
                      type="number"
                      maxLength={12}
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-muted-foreground">
                      Your bank details are encrypted and stored securely. We use this information only for processing payouts.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsBankFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveBankDetailsMutation.isPending}>
                      {saveBankDetailsMutation.isPending ? "Saving..." : "Save Details"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
