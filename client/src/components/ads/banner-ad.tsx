import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface BannerAdProps {
  placement: string;
  size?: "300x250" | "728x90" | "320x50" | "300x600" | "featured" | "970x250" | "home-hero" | "sidebar" | "inline" | { width: number; height: number };
  className?: string;
  onClose?: () => void;
}

export default function BannerAd({ 
  placement, 
  size: defaultSize = "300x250", 
  className = "", 
  onClose 
}: BannerAdProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [allAds, setAllAds] = useState<any[]>([]);
  const [trackedImpressions, setTrackedImpressions] = useState<Set<string>>(new Set());

  // Auto-rotate ads every 5 seconds
  useEffect(() => {
    if (allAds.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % allAds.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [allAds.length]);

  // Get size classes for the banner container with responsive, Amazon-style sizing
  const getSizeClasses = (size: any, placement: string) => {
    if (typeof size === 'string') {
      // For responsive sizing, use placement-specific dimensions
      if (size === 'responsive') {
        const placementSizing = {
          'HOME': "h-[130px] md:h-[150px] w-full", // Increased height for home page
          'HOME_INLINE': "h-[80px] md:h-[100px] w-full", // Inline content banner
          'DISCOVER_FEATURED': "h-[120px] md:h-[140px] w-full", // Featured banner - reduced height
          'DISCOVER': "h-[60px] md:h-[80px] w-full", // Standard banner - compact
          'ARTIST_PROFILE': "h-[70px] md:h-[90px] w-full", // Profile banner
          'SIDEBAR': "h-[200px] w-full max-w-[300px]", // Sidebar banner
        };
        return placementSizing[placement.toUpperCase() as keyof typeof placementSizing] || "h-[80px] md:h-[100px] w-full";
      }

      // Amazon-style responsive ad sizing for specific sizes
      const sizeClasses = {
        "300x250": "h-[200px] md:h-[250px] w-full max-w-[300px] mx-auto", // Medium Rectangle - responsive
        "728x90": "h-[70px] md:h-[90px] w-full max-w-[728px] mx-auto", // Leaderboard - responsive
        "320x50": "h-[50px] w-full max-w-[320px] mx-auto", // Mobile Banner
        "300x600": "h-[400px] md:h-[600px] w-full max-w-[300px] mx-auto", // Skyscraper - responsive
        "featured": "h-[160px] md:h-[200px] lg:h-[240px] w-full", // Featured banner - fully responsive
        "home-hero": "h-[88px] md:h-[100px] w-full", // Home page hero banner - matches premium card height
        "sidebar": "h-[250px] w-full max-w-[300px]", // Sidebar banner
        "inline": "h-[100px] md:h-[120px] w-full", // Inline content banner
      };
      return sizeClasses[size as keyof typeof sizeClasses] || "h-[88px] md:h-[100px] w-full";
    } else if (typeof size === 'object' && size.width && size.height) {
      // Custom size with responsive behavior
      const aspectRatio = size.width / size.height;
      if (aspectRatio > 2) {
        // Wide banner
        return "h-[80px] md:h-[120px] w-full";
      } else if (aspectRatio < 0.8) {
        // Tall banner
        return "h-[300px] md:h-[400px] w-full max-w-[300px] mx-auto";
      } else {
        // Square-ish banner
        return "h-[200px] md:h-[250px] w-full max-w-[300px] mx-auto";
      }
    }

    // Default responsive size - full width, no max-width constraints
    return "h-[88px] md:h-[100px] w-full";
  };

  const currentAd = allAds[currentAdIndex];

  // Only check premium status after auth is done loading
  // Users without a plan are considered FREE by default
  const isPremiumUser = !isAuthLoading && user?.plan?.type && user.plan.type !== "FREE";
  const isAdminUser = !isAuthLoading && user?.role === "admin";

  // Only skip ads if we're sure user is premium/admin
  if (!isAuthLoading && (isPremiumUser || isAdminUser)) {
    return null;
  }

  // Fetch ads for this placement
  const { data: ads, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ["ads", "placement", placement.toUpperCase(), user?._id],
    queryFn: async () => {
      const baseUrl = window.location.origin;
      const url = new URL('/api/ads/for-user', baseUrl);
      url.searchParams.set('type', 'BANNER');
      url.searchParams.set('placement', placement.toUpperCase());
      if (user?._id) url.searchParams.set('userId', user._id);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (user?._id) {
        const token = localStorage.getItem('ruc_auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url.toString(), { headers });
      const data = await response.json();
      
      if (!response.ok) throw new Error('Failed to fetch ads');
      return data;
    },
    enabled: !isAuthLoading && !!placement, // Only fetch after auth is loaded
    staleTime: 60 * 1000, // 1 minute - reduce API calls
    refetchOnWindowFocus: false, // Disable refetch on focus to reduce load
    retry: (failureCount, error) => {
      // Don't retry on 404 (no ads found) or 401 (unauthorized)
      if (error instanceof Error && error.message.includes('404')) return false;
      if (error instanceof Error && error.message.includes('401')) return false;
      return failureCount < 3;
    },
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Track impression mutation
  const trackImpressionMutation = useMutation({
    mutationFn: async (adId: string) => {
      // Only include auth header if we have a user
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (user?._id) {
        const token = localStorage.getItem('ruc_auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch("/api/ads/impressions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          adId,
          adType: "BANNER",
          placement: placement.toLowerCase(),
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
      // Only include auth header if we have a user
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (user?._id) {
        const token = localStorage.getItem('ruc_auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch("/api/ads/clicks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          adId,
          adType: "BANNER",
          impressionId: currentAd?.impressionId // We'll set this when impression is tracked
        })
      });
      if (!response.ok) throw new Error("Failed to track click");
      return response.json();
    }
  });

  // Force refetch on component mount to ensure latest data
  useEffect(() => {
    if (placement) {
      refetch();
    }
  }, [placement, refetch]);

  useEffect(() => {
    if (ads && Array.isArray(ads) && ads.length > 0) {
      setAllAds(ads);
      if (currentAdIndex >= ads.length) {
        setCurrentAdIndex(0);
      }

      // Track impression only once per ad session, and only for the initial load
      const currentAdData = ads[0]; // Track impression only for the first ad shown
      if (currentAdData && !trackedImpressions.has(currentAdData._id)) {
        trackImpressionMutation.mutate(currentAdData._id, {
          onSuccess: (impression) => {
            setTrackedImpressions(prev => {
              const newSet = new Set(prev);
              newSet.add(currentAdData._id);
              return newSet;
            });
            setAllAds((prev) => 
              prev.map((ad, index) => 
                index === 0 
                  ? { ...ad, impressionId: impression._id }
                  : ad
              )
            );
          }
        });
      }
    } else if (ads !== undefined && (!ads || ads.length === 0)) {
      setAllAds([]);
    }
  }, [ads]); // Remove currentAdIndex dependency

  // Track impressions for individual ads when they become visible during rotation
  useEffect(() => {
    if (currentAd && !trackedImpressions.has(currentAd._id)) {
      trackImpressionMutation.mutate(currentAd._id, {
        onSuccess: (impression) => {
          setTrackedImpressions(prev => {
            const newSet = new Set(prev);
            newSet.add(currentAd._id);
            return newSet;
          });
          setAllAds((prev) => 
            prev.map((ad) => 
              ad._id === currentAd._id 
                ? { ...ad, impressionId: impression._id }
                : ad
            )
          );
        }
      });
    }
  }, [currentAd?._id, trackedImpressions]);

  const handleAdClick = () => {
    if (currentAd?.callToAction?.url) {
      // Track click
      trackClickMutation.mutate(currentAd._id);

      // Open the URL
      window.open(currentAd.callToAction.url, '_blank');
    }
  };

  const handlePrevAd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentAdIndex((prev) => (prev - 1 + allAds.length) % allAds.length);
  };

  const handleNextAd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentAdIndex((prev) => (prev + 1) % allAds.length);
  };

  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className={`bg-muted rounded ${getSizeClasses(defaultSize, placement)}`}></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return null;
  }

  if (!ads || ads.length === 0 || !currentAd) {
    return null;
  }

  // Use dynamic size from ad data, fallback to prop default
  const adSize = currentAd?.size || defaultSize;
  const sizeClasses = getSizeClasses(adSize, placement);

  return (
    <div className={`relative group w-full ${className}`}>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-20 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 hover:bg-black/40 text-white"
          onClick={onClose}
        >
          <X className="w-3 h-3" />
        </Button>
      )}

      {/* Navigation Arrows - Show only if multiple ads */}
      {allAds.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm"
            onClick={handlePrevAd}
            aria-label="Previous ad"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm"
            onClick={handleNextAd}
            aria-label="Next ad"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </>
      )}

      {/* Dots indicator - Show only if multiple ads */}
      {allAds.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex space-x-1">
          {allAds.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentAdIndex 
                  ? 'bg-white scale-125' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentAdIndex(index);
              }}
              aria-label={`Go to ad ${index + 1}`}
            />
          ))}
        </div>
      )}

      <div
        className={`relative cursor-pointer transition-all duration-300 hover:shadow-xl w-full ${sizeClasses} group overflow-hidden rounded-lg`}
        onClick={handleAdClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAdClick();
          }
        }}
        aria-label={`Advertisement: ${currentAd.title}${currentAd.callToAction ? ` - ${currentAd.callToAction.text}` : ''}`}
      >
        <img
          src={currentAd.imageUrl}
          alt={currentAd.title}
          className="w-full h-full object-cover block transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250";
          }}
        />

        {/* Subtle overlay for better text readability and hover effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent group-hover:from-black/60 transition-all duration-300" />

        {currentAd.callToAction && (
          <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-white transition-colors duration-300">
                  {currentAd.callToAction.text}
                </p>
                <p className="text-xs opacity-90 truncate">
                  {currentAd.title}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle sponsor label */}
      <div className="absolute top-2 left-2 z-10">
        <span className="text-xs px-2 py-1 bg-black/40 backdrop-blur-sm text-white rounded-full opacity-60">
          Sponsored
        </span>
      </div>
    </div>
  );
}
