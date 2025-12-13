import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Import shared types
import { AudioAd, BannerAd } from "./types";

// Import modular components
import SimpleAdList from "./ads/SimpleAdList";
import AdForm from "./ads/AdForm";
import AdAnalyticsDashboard from "./ads/AdAnalyticsDashboard";

export default function AdManagementPanel() {
  const [activeTab, setActiveTab] = useState("audio");
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [editingAd, setEditingAd] = useState<AudioAd | BannerAd | null>(null);
  const [selectedAdType, setSelectedAdType] = useState<"audio" | "banner">("audio");

  const queryClient = useQueryClient();

  // Fetch ads by type
  const { data: audioAds, isLoading: audioAdsLoading, error: audioAdsError } = useQuery<AudioAd[]>({
    queryKey: ["/api/ads/audio"],
    queryFn: async () => {
      const response = await fetch("/api/ads/audio", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch audio ads: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bannerAds, isLoading: bannerAdsLoading, error: bannerAdsError } = useQuery<BannerAd[]>({
    queryKey: ["/api/ads/banner"],
    queryFn: async () => {
      const response = await fetch("/api/ads/banner", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch banner ads: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Ad mutations
  const createAdMutation = useMutation({
    mutationFn: async (adData: any) => {
      const endpoint = selectedAdType === "audio" ? "/api/ads/audio" : "/api/ads/banner";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(adData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create ad");
      }

      const createdAd = await response.json();

      // For banner ads only, create placements automatically
      if (selectedAdType === "banner" && createdAd._id) {
        const placements = [
          {
            type: "BANNER_HOME",
            adId: createdAd._id,
            adType: "BANNER",
            priority: 1,
            isActive: true,
            conditions: {
              minPlays: 0,
              timeInterval: 300,
              maxPerSession: 3
            },
            targeting: {
              userTypes: ["FREE"],
              deviceTypes: ["mobile", "desktop", "tablet"]
            }
          },
          {
            type: "BANNER_DISCOVER",
            adId: createdAd._id,
            adType: "BANNER",
            priority: 1,
            isActive: true,
            conditions: {
              minPlays: 0,
              timeInterval: 300,
              maxPerSession: 2
            },
            targeting: {
              userTypes: ["FREE"],
              deviceTypes: ["mobile", "desktop", "tablet"]
            }
          }
        ];

        // Create placements for the banner ad
        for (const placementData of placements) {
          try {
            const placementResponse = await fetch("/api/ads/placements", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
              },
              body: JSON.stringify(placementData)
            });

            if (!placementResponse.ok) {
              const errorData = await placementResponse.json();
              console.error('Failed to create placement:', errorData);
            }
          } catch (error) {
            console.error('Error creating placement:', error);
          }
        }
      }

      return createdAd;
    },
    onSuccess: (data) => {
      toast({
        title: "Ad created",
        description: selectedAdType === "banner"
          ? "Banner ad has been created and will appear on the assigned placements"
          : "Ad has been created successfully"
      });

      // Invalidate specific query keys for real-time updates
      if (data.placements && Array.isArray(data.placements)) {
        // Invalidate queries for each placement this ad is assigned to
        for (const placement of data.placements) {
          queryClient.invalidateQueries({ queryKey: ["ads", "placement", placement.toLowerCase()] });
        }
      } else {
        // Fallback: invalidate all ad-related queries
        queryClient.invalidateQueries({ queryKey: ["ads", "placement", "home"] });
        queryClient.invalidateQueries({ queryKey: ["ads", "placement", "discover"] });
      }

      setShowCreateAd(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create ad",
        variant: "destructive"
      });
    }
  });

  const editAudioAdMutation = useMutation({
    mutationFn: async ({ adId, adData }: { adId: string; adData: any }) => {
      const response = await fetch(`/api/ads/audio/${adId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(adData)
      });

      if (!response.ok) {
        throw new Error("Failed to update audio ad");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/audio"] });
      toast({
        title: "Audio ad updated",
        description: "Audio ad has been updated successfully"
      });
      setEditingAd(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update audio ad",
        variant: "destructive"
      });
    }
  });

  const editBannerAdMutation = useMutation({
    mutationFn: async ({ adId, adData }: { adId: string; adData: any }) => {
      const response = await fetch(`/api/ads/banner/${adId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(adData)
      });

      if (!response.ok) {
        throw new Error("Failed to update banner ad");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate ad list queries and specific placement queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/ads/banner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ads/audio"] });

      // Invalidate placement queries based on updated ad placements
      if (data.placements && Array.isArray(data.placements)) {
        for (const placement of data.placements) {
          queryClient.invalidateQueries({ queryKey: ["ads", "placement", placement.toLowerCase()] });
        }
      } else {
        // Fallback: invalidate common placement queries
        queryClient.invalidateQueries({ queryKey: ["ads", "placement", "home"] });
        queryClient.invalidateQueries({ queryKey: ["ads", "placement", "discover"] });
      }

      toast({
        title: "Banner ad updated",
        description: "Banner ad has been updated successfully and will reflect immediately"
      });
      setEditingAd(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update banner ad",
        variant: "destructive"
      });
    }
  });

  const deleteAudioAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/audio/${adId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete audio ad");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/audio"] });
      toast({
        title: "Audio ad deleted",
        description: "Audio ad has been deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete audio ad",
        variant: "destructive"
      });
    }
  });

  const deleteBannerAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/banner/${adId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete banner ad");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/banner"] });
      toast({
        title: "Banner ad deleted",
        description: "Banner ad has been deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete banner ad",
        variant: "destructive"
      });
    }
  });

  // Event handlers
  const handleCreateAd = (adData: any) => {
    createAdMutation.mutate(adData);
  };

  const handleEditAd = (ad: AudioAd | BannerAd, type: "audio" | "banner") => {
    setEditingAd(ad);
    setSelectedAdType(type);
    setShowCreateAd(true);
  };

  const handleDeleteAd = (adId: string, type: "audio" | "banner") => {
    if (window.confirm('Are you sure you want to delete this ad? This action cannot be undone.')) {
      if (type === "audio") {
        deleteAudioAdMutation.mutate(adId);
      } else {
        deleteBannerAdMutation.mutate(adId);
      }
    }
  };

  const handleUpdateAd = (adData: any) => {
    if (!editingAd) return;

    const adId = editingAd._id;
    
    // Determine ad type based on the current selectedAdType or the presence of specific fields
    if (selectedAdType === "audio" || 'audioUrl' in editingAd) {
      editAudioAdMutation.mutate({ adId, adData });
    } else if (selectedAdType === "banner" || 'imageUrl' in editingAd) {
      editBannerAdMutation.mutate({ adId, adData });
    } else {
      toast({
        title: "Error",
        description: "Unable to determine ad type for update",
        variant: "destructive"
      });
    }
  };

  // Add error handling
  if (audioAdsError || bannerAdsError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading ads data</div>
        <div className="text-sm text-muted-foreground">
          {audioAdsError?.message || bannerAdsError?.message || "Unknown error occurred"}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Check console for more details or try refreshing the page.
        </p>
      </div>
    );
  }

  const audioAdsArray = audioAds || [];
  const bannerAdsArray = bannerAds || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ad Management</h2>
          <p className="text-muted-foreground">Create and manage audio and banner advertisements</p>
        </div>

        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => {
              setSelectedAdType("audio");
              setActiveTab("audio");
              setShowCreateAd(true);
            }}
            variant={activeTab === "audio" ? "default" : "outline"}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Audio Ad
          </Button>
          
          <Button 
            onClick={() => {
              setSelectedAdType("banner");
              setActiveTab("banner");
              setShowCreateAd(true);
            }}
            variant={activeTab === "banner" ? "default" : "outline"}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Banner Ad
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audio">Audio Ads</TabsTrigger>
          <TabsTrigger value="banner">Banner Ads</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Audio Ads Tab */}
        <TabsContent value="audio" className="space-y-4">
          <SimpleAdList
            audioAds={audioAdsArray}
            bannerAds={[]}
            audioAdsLoading={audioAdsLoading}
            bannerAdsLoading={false}
            selectedAdType="audio"
            onAdTypeChange={() => {}}
            onEdit={handleEditAd}
            onDelete={(adId) => handleDeleteAd(adId, "audio")}
          />
        </TabsContent>

        {/* Banner Ads Tab */}
        <TabsContent value="banner" className="space-y-4">
          <SimpleAdList
            audioAds={[]}
            bannerAds={bannerAdsArray}
            audioAdsLoading={false}
            bannerAdsLoading={bannerAdsLoading}
            selectedAdType="banner"
            onAdTypeChange={() => {}}
            onEdit={handleEditAd}
            onDelete={(adId) => handleDeleteAd(adId, "banner")}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <AdAnalyticsDashboard />
        </TabsContent>
      </Tabs>

      {/* Ad Form Dialog */}
      <AdForm
        isOpen={showCreateAd}
        onClose={() => {
          setShowCreateAd(false);
          setEditingAd(null);
        }}
        onSubmit={editingAd ? handleUpdateAd : handleCreateAd}
        editingAd={editingAd}
        adType={selectedAdType}
        isSubmitting={createAdMutation.isPending || editAudioAdMutation.isPending || editBannerAdMutation.isPending}
      />
    </div>
  );
}
