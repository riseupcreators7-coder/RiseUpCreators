import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, Music } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

// Google AdSense integration for in-feed ads
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface InFeedAdProps {
  placement: string; // "playlist", "song-list", "artist-feed", "recommendations"
  index?: number; // Position in the feed
  className?: string;
  onClose?: () => void;
}

export default function InFeedAd({ 
  placement, 
  index = 0,
  className = "", 
  onClose 
}: InFeedAdProps) {
  const { user } = useAuth();
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [showGoogleAd, setShowGoogleAd] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // Check if user has premium features (no in-feed ads for any paid plan) or is an admin
  const isPremiumUser = user?.plan?.type && user.plan.type !== "FREE";
  const isAdminUser = user?.role === "admin";

  // If user is premium or admin, don't show in-feed ads
  if (isPremiumUser || isAdminUser) {
    return null;
  }

  // Fetch in-feed ads for this placement
  const { data: ads, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ["ads", "in-feed", placement.toLowerCase(), index],
    queryFn: async () => {
      const response = await fetch(`/api/ads/for-user?type=IN_FEED&placement=${placement.toLowerCase()}&index=${index}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch in-feed ads');
      return response.json();
    },
    enabled: !!placement,
    staleTime: 45 * 1000, // 45 seconds for in-feed ads
    refetchOnWindowFocus: true,
  });

  // Track impression mutation
  const trackImpressionMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch("/api/ads/impressions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          adId,
          adType: "IN_FEED",
          placement: placement.toLowerCase(),
          feedPosition: index,
          deviceInfo: {
            type: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            os: navigator.platform,
            browser: navigator.userAgent
          }
        })
      });
      if (!response.ok) throw new Error("Failed to track impression");
      return response.json();
    }
  });

  // Track click mutation
  const trackClickMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch("/api/ads/clicks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          adId,
          adType: "IN_FEED",
          impressionId: currentAd?.impressionId
        })
      });
      if (!response.ok) throw new Error("Failed to track click");
      return response.json();
    }
  });

  useEffect(() => {
    if (ads && Array.isArray(ads) && ads.length > 0) {
      const ad = ads[0];
      setCurrentAd(ad);
      setShowGoogleAd(false);

      // Track impression only once per ad load
      if (!hasTrackedImpression) {
        trackImpressionMutation.mutate(ad._id, {
          onSuccess: (impression) => {
            setCurrentAd((prev: any) => prev ? { ...prev, impressionId: impression._id } : prev);
            setHasTrackedImpression(true);
          }
        });
      }
    } else if (ads !== undefined && (!ads || ads.length === 0)) {
      // No internal ads available, show Google AdSense in-feed ad
      setShowGoogleAd(true);
      setCurrentAd(null);
    }
  }, [ads, placement, index]);

  const handleAdClick = () => {
    if (currentAd?.callToAction?.url) {
      trackClickMutation.mutate(currentAd._id);
      window.open(currentAd.callToAction.url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card className={`p-4 mb-4 animate-pulse ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-muted rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </Card>
    );
  }

  // Show Google AdSense in-feed ad
  if (showGoogleAd) {
    useEffect(() => {
      // Initialize AdSense for in-feed ads
      if (window.adsbygoogle) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('AdSense initialization error:', e);
        }
      }
    }, []);

    return (
      <Card className={`relative overflow-hidden mb-4 ${className}`}>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 w-6 h-6"
            onClick={onClose}
          >
            <X className="w-3 h-3" />
          </Button>
        )}

        <div className="min-h-[120px] p-4">
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-format="fluid"
            data-ad-layout-key="-6t+ed+2i-1n-4w"
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Replace with your AdSense publisher ID
            data-ad-slot="YYYYYYYYYY" // Replace with your in-feed ad slot ID
          />
        </div>

        <div className="px-4 pb-2 bg-muted/30">
          <p className="text-xs text-muted-foreground flex items-center">
            <Music className="w-3 h-3 mr-1" />
            Sponsored Content • In Feed
          </p>
        </div>
      </Card>
    );
  }

  if (!currentAd) {
    return null;
  }

  // Show internal platform ad in native feed format
  return (
    <Card className={`relative overflow-hidden mb-4 cursor-pointer hover:shadow-md transition-shadow ${className}`}>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 w-6 h-6"
          onClick={onClose}
        >
          <X className="w-3 h-3" />
        </Button>
      )}

      <div className="p-4" onClick={handleAdClick}>
        <div className="flex items-center space-x-4">
          {/* Ad Image */}
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=64&h=64";
              }}
            />
          </div>

          {/* Ad Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm mb-1 truncate">
              {currentAd.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {currentAd.description || "Discover amazing content tailored for you"}
            </p>
            
            {currentAd.callToAction && (
              <div className="flex items-center text-xs text-primary">
                <span className="mr-1">{currentAd.callToAction.text}</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-2 bg-muted/30">
        <p className="text-xs text-muted-foreground flex items-center">
          <Music className="w-3 h-3 mr-1" />
          Sponsored • {currentAd.advertiser || "Music Partner"}
        </p>
      </div>
    </Card>
  );
}