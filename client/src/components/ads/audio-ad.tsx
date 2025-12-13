import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkipForward, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface AudioAdData {
  _id: string;
  title: string;
  audioUrl: string;
  durationSec: number;
  callToAction?: {
    text: string;
    url?: string;
  };
}

interface AudioAdProps {
  adId: string;
  adData?: AudioAdData; // Optional pre-loaded ad data
  onComplete: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  className?: string;
}

export default function AudioAd({ adId, adData, onComplete, onSkip, canSkip = false, className = "" }: AudioAdProps) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  // Check if user has premium features (skip ads for any paid plan) or is an admin
  // Default to FREE plan if no plan is set, so ads are shown by default
  const userPlanType = user?.plan?.type || "FREE";
  const isPremiumUser = userPlanType !== "FREE";
  const isAdminUser = user?.role === "admin";

  // If user is premium or admin, don't show ads
  if (isPremiumUser || isAdminUser) {
    onComplete(); // Complete immediately for premium users and admins
    return null;
  }

  // Fetch ad details (only if adData is not provided)
  const { data: fetchedAd, isLoading } = useQuery<AudioAdData>({
    queryKey: ["/api/ads/audio", adId],
    enabled: !!adId && !adData, // Only fetch if no ad data is provided
    staleTime: 5 * 60 * 1000,
  });

  // Use provided adData or fetched data
  const ad = adData || fetchedAd;

  // Track impression mutation
  const trackImpressionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ads/impressions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          adId,
          adType: "AUDIO",
          placement: "player",
          deviceInfo: {
            type: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            os: navigator.platform,
            browser: navigator.userAgent
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to track impression: ${response.status}`);
      }
      
      return response.json();
    }
  });

  // Track completion mutation
  const trackCompletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ads/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          adId,
          adType: "AUDIO",
          placement: "player"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to track completion: ${response.status}`);
      }
      
      return response.json();
    }
  });

  // Track click mutation
  const trackClickMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ads/clicks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          adId,
          adType: "AUDIO",
          impressionId: null
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to track click: ${response.status}`);
      }
      
      return response.json();
    }
  });

  useEffect(() => {
    if (ad && audioRef.current) {
      audioRef.current.src = ad.audioUrl;
      audioRef.current.volume = volume;

      // Track impression when ad loads
      trackImpressionMutation.mutate();

      // Auto-play the ad
      audioRef.current.play().catch(error => {
        console.error('Failed to play ad:', error);
      });
    }
  }, [ad]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Show skip button after 5 seconds for skippable ads
      if (canSkip && audio.currentTime >= 5 && !showSkip) {
        setShowSkip(true);
      }

      // Auto-complete when ad finishes
      if (audio.currentTime >= audio.duration - 0.1) {
        handleAdComplete();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [canSkip, showSkip]);

  const handleAdComplete = () => {
    // Track completion
    trackCompletionMutation.mutate();

    // Call completion callback
    onComplete();
  };

  const handleSkip = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onSkip?.();
  };

  const handleCallToAction = () => {
    if (ad?.callToAction?.url) {
      // Track click
      trackClickMutation.mutate();

      // Open URL
      window.open(ad.callToAction.url, '_blank');
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if ((isLoading && !adData) || !ad) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded mb-2"></div>
          <div className="h-3 bg-muted rounded w-3/4"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-200 ${className}`}>
      <audio ref={audioRef} preload="metadata" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Advertisement</h3>
          <p className="text-sm text-muted-foreground">{ad.title}</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="w-8 h-8"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>

          {canSkip && showSkip && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkip}
              className="flex items-center space-x-1"
            >
              <SkipForward className="w-3 h-3" />
              <span>Skip</span>
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Call to Action */}
      {ad.callToAction && (
        <div className="text-center">
          <Button
            onClick={handleCallToAction}
            className="flex items-center space-x-2 mx-auto"
          >
            <span>{ad.callToAction.text}</span>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground">
          Ad • {formatTime(duration - currentTime)} remaining
        </p>
      </div>
    </Card>
  );
}
