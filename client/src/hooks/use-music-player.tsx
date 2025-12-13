import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

// Throttle utility for progress updates
const throttle = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  return (...args: any[]) => {
    const currentTime = Date.now();
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

// Types
interface Song {
  _id: string;
  title: string;
  artistName: string;
  fileUrl: string;
  artworkUrl?: string;
  durationSec?: number;
}

interface MusicPlayerContextType {
  // Current state
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  volume: number;
  
  // Controls
  play: (song?: Song) => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  
  // Queue management
  queue: Song[];
  addToQueue: (songs: Song[]) => void;
  clearQueue: () => void;
  removeFromQueue: (index: number) => void;
  
  // Playback modes
  shuffle: boolean;
  repeat: "none" | "one" | "all";
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  
  // Ad state
  isPlayingAd: boolean;
  currentAd: any;
  skipAd: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Basic state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "one" | "all">("none");
  
  // Play tracking state
  const [playStartTime, setPlayStartTime] = useState<Date | null>(null);
  const [playTracked, setPlayTracked] = useState(false);
  const [trackingTimeout, setTrackingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Ad state (simplified)
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [currentAd, setCurrentAd] = useState<any>(null);

  // Function to track play with duration
  const trackPlay = useCallback((song: Song, playDuration: number) => {
    if (!user || !song._id || playDuration < 30) return;
    
    fetch(`/api/songs/${song._id}/play`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playDuration })
    }).then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Play tracking failed');
    }).then(data => {
      if (data.validated) {
        // Play tracking successful
      } else {
        // Play not counted
      }
    }).catch(error => {
      console.error('❌ Failed to track play:', error);
    });
  }, [user]);

  // Function to start play tracking
  const startPlayTracking = useCallback((song: Song) => {
    if (!user || !song._id) return;
    
    // Clear any existing tracking
    if (trackingTimeout) {
      clearTimeout(trackingTimeout);
    }
    
    setPlayStartTime(new Date());
    setPlayTracked(false);
    
    // Set timeout to track play after 30 seconds
    const timeout = setTimeout(() => {
      if (playStartTime && !playTracked) {
        const duration = (new Date().getTime() - playStartTime.getTime()) / 1000;
        trackPlay(song, duration);
        setPlayTracked(true);
      }
    }, 30000); // 30 seconds
    
    setTrackingTimeout(timeout);
  }, [user, trackingTimeout, playStartTime, playTracked, trackPlay]);

  // Function to stop play tracking
  const stopPlayTracking = useCallback(() => {
    if (trackingTimeout) {
      clearTimeout(trackingTimeout);
      setTrackingTimeout(null);
    }
    
    // Track the play if it was long enough and not yet tracked
    if (playStartTime && !playTracked && currentSong) {
      const duration = (new Date().getTime() - playStartTime.getTime()) / 1000;
      if (duration >= 30) {
        trackPlay(currentSong, duration);
        setPlayTracked(true);
      }
    }
    
    setPlayStartTime(null);
    setPlayTracked(false);
  }, [trackingTimeout, playStartTime, playTracked, currentSong, trackPlay]);
  
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const adAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    adAudioRef.current = new Audio();
    adAudioRef.current.volume = 0.8;
    
    const audio = audioRef.current;
    const adAudio = adAudioRef.current;
    
    // Main audio event handlers
    const handleLoadedMetadata = () => {
      if (audio && audio.duration) {
        setDuration(audio.duration);
      }
    };
    
    const handleTimeUpdate = throttle(() => {
      if (audio) {
        const currentTime = audio.currentTime;
        const duration = audio.duration || 0;
        setCurrentTime(currentTime);
        setProgress(duration > 0 ? (currentTime / duration) * 100 : 0);
      }
    }, 100); // Throttle to 100ms (10 times per second instead of 60)
    
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      
      // Auto-play next song based on repeat mode
      if (repeat === "one" && currentSong) {
        // Repeat current song
        play(currentSong);
      } else if (queue.length > 0) {
        // Play next song in queue
        next();
      }
    };
    
    const handleCanPlay = () => {
      // Audio ready to play
    };
    
    const handleError = (e: Event) => {
      console.error('🚫 Audio error:', e);
      setIsPlaying(false);
    };
    
    // Add event listeners for main audio only
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    
    return () => {
      // Cleanup main audio only
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      
      audio.pause();
    };
  }, []);

  // Ad event handlers (outside of useEffect to avoid stale closures)
  const handleAdLoadedMetadata = useCallback(() => {
    if (adAudioRef.current && adAudioRef.current.duration) {
      setDuration(adAudioRef.current.duration);
      setCurrentTime(0);
      setProgress(0);
    }
  }, []);
    
  const handleAdTimeUpdate = useCallback(() => {
    if (adAudioRef.current) {
      const currentTime = adAudioRef.current.currentTime;
      const duration = adAudioRef.current.duration || 0;
      
      if (!isNaN(currentTime) && !isNaN(duration) && duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        setCurrentTime(currentTime);
        setDuration(duration);
        setProgress(progressPercent);
      }
    }
  }, []);
    
  const handleAdEnded = useCallback(() => {
    setIsPlayingAd(false);
    setCurrentAd(null);
    
    // Reset time states for transition
    setCurrentTime(0);
    setProgress(0);
    setDuration(0);
    
    // Get the current song from state and play it
    if (currentSong && audioRef.current) {
      audioRef.current.src = currentSong.fileUrl;
      audioRef.current.load();
      
      // Wait for the song to be ready to play
      const playSong = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            
            // Start play tracking when song auto-plays after ad
            if (currentSong) {
              startPlayTracking(currentSong);
            }
          }).catch(error => {
            console.error('Song auto-play failed:', error);
            setIsPlaying(false);
          });
        }
      };
      
      // Try to play immediately, with fallback
      if (audioRef.current.readyState >= 2) {
        playSong();
      } else {
        audioRef.current.addEventListener('canplay', playSong, { once: true });
        // Fallback timeout
        setTimeout(playSong, 1000);
      }
    } else {
      setIsPlaying(false);
    }
  }, [currentSong]);

  const handleAdError = useCallback((e: Event) => {
    console.error('Ad audio error:', e);
    // Skip to song if ad fails
    if (currentSong && audioRef.current) {
      setIsPlayingAd(false);
      setCurrentAd(null);
      audioRef.current.src = currentSong.fileUrl;
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        
        // Start play tracking when song plays after ad error
        if (currentSong) {
          startPlayTracking(currentSong);
        }
      }).catch(console.error);
    }
  }, [currentSong]);

  // Separate useEffect for ad event listeners
  useEffect(() => {
    const adAudio = adAudioRef.current;
    if (adAudio) {
      adAudio.addEventListener('loadedmetadata', handleAdLoadedMetadata);
      adAudio.addEventListener('timeupdate', handleAdTimeUpdate);
      adAudio.addEventListener('ended', handleAdEnded);
      adAudio.addEventListener('error', handleAdError);
      
      return () => {
        adAudio.removeEventListener('loadedmetadata', handleAdLoadedMetadata);
        adAudio.removeEventListener('timeupdate', handleAdTimeUpdate);
        adAudio.removeEventListener('ended', handleAdEnded);
        adAudio.removeEventListener('error', handleAdError);
      };
    }
  }, [handleAdLoadedMetadata, handleAdTimeUpdate, handleAdEnded, handleAdError]);

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
  // Fetch ads for non-premium users (fixed logic)
  // Handle cases where user.plan is undefined/null (new users should see ads)
  // Users without a plan are considered FREE users and should see ads
  const userPlanType = user?.plan?.type || "FREE";
  const isPremium = userPlanType === "PREMIUM" || userPlanType === "ARTIST";
  
  const { data: ads = [], isLoading: adsLoading, error: adsError, refetch: refetchAds } = useQuery({
    queryKey: ["/api/ads/for-user", "AUDIO", "PRE_ROLL"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/ads/for-user?type=AUDIO&placement=PRE_ROLL", {
          headers: user ? {
            'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
          } : {}
        });
        if (!response.ok) {
          console.error('🚫 Ad fetch failed:', response.status, response.statusText);
          return [];
        }
        const ads = await response.json();
        return ads;
      } catch (error) {
        console.error('Ad fetch error:', error);
        return [];
      }
    },
    enabled: !!user, // Temporarily enable for all users to debug
    staleTime: 1 * 60 * 1000, // Reduced from 5 minutes to 1 minute for testing
    refetchOnWindowFocus: true,
    retry: 3
  });
  
  // Track ad impression
  const trackAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      await fetch("/api/ads/impressions", {
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
    }
  });
  
  // Ad frequency tracking with per-user, per-ad limits (3 times per ad per user)
  const shouldShowAd = useCallback(() => {
    if (isPremium) {
      return false;
    }
    if (!ads || ads.length === 0) {
      return false;
    }
    if (!user?._id) {
      return false;
    }

    // Get eligible ads (ads that haven't reached the 3-play limit for this user)
    const eligibleAds = getEligibleAds();
    
    if (eligibleAds.length === 0) {
      return false;
    }
    
    // 80% chance to show ad if eligible ads exist
    const randomChance = Math.random();
    const shouldShow = randomChance < 0.8;
    return shouldShow;
  }, [isPremium, ads, user]);

  // Get play count for specific ad for current user
  const getAdPlayCount = useCallback((adId: string) => {
    if (!user?._id) return 0;
    const today = new Date().toDateString();
    const adCountKey = `ruc_ad_${user._id}_${adId}_${today}`;
    return parseInt(localStorage.getItem(adCountKey) || '0');
  }, [user]);

  // Get ads that haven't reached the 3-play limit for current user
  const getEligibleAds = useCallback(() => {
    if (!ads || !user?._id) {
      return [];
    }
    
    const eligibleAds = ads.filter((ad: any) => {
      const adPlayCount = getAdPlayCount(ad._id);
      const isEligible = adPlayCount < 3;
      return isEligible;
    });
    
    return eligibleAds;
  }, [ads, user, getAdPlayCount]);
  
  // Track ad play for specific ad and user
  const incrementAdCount = useCallback((adId: string) => {
    if (!user?._id) return;
    const today = new Date().toDateString();
    const adCountKey = `ruc_ad_${user._id}_${adId}_${today}`;
    const currentCount = parseInt(localStorage.getItem(adCountKey) || '0');
    const newCount = currentCount + 1;
    localStorage.setItem(adCountKey, newCount.toString());
  }, [user, ads]);

  // Select random ad from eligible ads
  const selectRandomAd = useCallback(() => {
    const eligibleAds = getEligibleAds();
    if (eligibleAds.length === 0) return null;
    
    // Random selection from eligible ads
    const randomIndex = Math.floor(Math.random() * eligibleAds.length);
    const selectedAd = eligibleAds[randomIndex];
    return selectedAd;
  }, [getEligibleAds]);
  
  // Debug ads periodically
  useEffect(() => {
    const debugAds = () => {
      if (!ads?.length || !user?._id) return;
      
      const eligibleAds = getEligibleAds();
    };
  }, []);
  
  // Main play function (simplified)
  const play = useCallback((song?: Song) => {
    // ✅ FIX: Always stop any existing playback first to prevent multiple songs playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (adAudioRef.current) {
      adAudioRef.current.pause();
      adAudioRef.current.currentTime = 0;
    }
    
    // Stop any existing play tracking
    stopPlayTracking();
    
    // If no song provided, resume current
    if (!song) {
      if (currentSong && audioRef.current) {
        setIsPlaying(true); // Immediate state update
        audioRef.current.play().catch(error => {
          console.error('Resume play failed:', error);
          setIsPlaying(false); // Revert on error
        });
      }
      return;
    }
    
    // Check if this is the same song that's already loaded
    if (currentSong && currentSong._id === song._id) {
      // Call togglePlayPause directly to avoid dependency issues
      if (isPlaying) {
        // Pausing
        setIsPlaying(false);
        if (isPlayingAd && adAudioRef.current) {
          adAudioRef.current.pause();
        } else if (audioRef.current) {
          audioRef.current.pause();
          stopPlayTracking();
        }
      } else {
        // Playing
        setIsPlaying(true);
        if (isPlayingAd && adAudioRef.current) {
          adAudioRef.current.play().catch(error => {
            console.error('🚫 Ad resume failed:', error);
            setIsPlaying(false);
          });
        } else if (audioRef.current) {
          audioRef.current.play().catch(error => {
            console.error('🚫 Song resume failed:', error);
            setIsPlaying(false);
          });
        }
      }
      return;
    }
    
    // Check if we should show an ad for non-premium users
    if (!isPremium && shouldShowAd() && ads.length > 0) {
      const ad = selectRandomAd();
      
      if (!ad) {
        // Play song directly if no eligible ads
      } else {
        // ✅ FIX: Ensure audio elements are properly reset
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        
        setCurrentAd(ad);
        setIsPlayingAd(true);
        setCurrentSong(song); // Set song for after ad
        
        // Reset time/progress for ad
        setCurrentTime(0);
        setProgress(0);
        setDuration(0);
        
        if (adAudioRef.current) {
          adAudioRef.current.src = ad.audioUrl;
          adAudioRef.current.load(); // Add explicit load
          
          // Wait for metadata to load before playing
          const handleCanPlayAd = () => {
            if (adAudioRef.current) {
              adAudioRef.current.play().then(() => {
                setIsPlaying(true);
                trackAdMutation.mutate(ad._id);
                incrementAdCount(ad._id); // Track for this specific ad
              }).catch(error => {
                console.error('Ad play failed:', error);
                // Fallback to song if ad fails
                setIsPlayingAd(false);
                setCurrentAd(null);
                if (audioRef.current) {
                  audioRef.current.src = song.fileUrl;
                  audioRef.current.load();
                  audioRef.current.play().then(() => {
                    setIsPlaying(true);
                    
                    // Start play tracking when song plays after ad failure
                    startPlayTracking(song);
                  }).catch(console.error);
                }
              });
              adAudioRef.current.removeEventListener('canplay', handleCanPlayAd);
            }
          };
          
          adAudioRef.current.addEventListener('canplay', handleCanPlayAd);
          
          // Fallback timeout
          setTimeout(() => {
            if (adAudioRef.current) {
              adAudioRef.current.removeEventListener('canplay', handleCanPlayAd);
              handleCanPlayAd(); // Try to play anyway
            }
          }, 1000);
        }
        return;
      }
    }
    
    // Play song directly
    setCurrentSong(song);
    setIsPlayingAd(false);
    setCurrentAd(null);
    
    if (audioRef.current) {
      // ✅ FIX: Ensure clean state before setting new source
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.currentTime = 0;
      
      // Set new source
      audioRef.current.src = song.fileUrl;
      audioRef.current.load();
      
      // Play after loading
      const playWhenReady = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            
            // Start play tracking
            startPlayTracking(song);
          }).catch(error => {
            console.error('❌ Failed to play:', error);
            setIsPlaying(false);
          });
        }
      };
      
      // Wait for canplay event or timeout
      const handleCanPlay = () => {
        audioRef.current?.removeEventListener('canplay', handleCanPlay);
        playWhenReady();
      };
      
      audioRef.current.addEventListener('canplay', handleCanPlay);
      
      // Fallback timeout
      setTimeout(() => {
        audioRef.current?.removeEventListener('canplay', handleCanPlay);
        playWhenReady();
      }, 500);
    }
  }, [currentSong, isPlaying, isPlayingAd, isPremium, shouldShowAd, ads, trackAdMutation, stopPlayTracking, startPlayTracking, selectRandomAd, incrementAdCount]);
  
  const pause = useCallback(() => {
    // Immediate state update
    setIsPlaying(false);
    
    // Handle audio pause
    if (isPlayingAd && adAudioRef.current) {
      adAudioRef.current.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
      // Stop play tracking when paused
      stopPlayTracking();
    }
  }, [isPlayingAd, stopPlayTracking]);
  
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      // Pausing - immediate action
      setIsPlaying(false);
      
      if (isPlayingAd && adAudioRef.current) {
        adAudioRef.current.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
        // Stop play tracking when paused
        stopPlayTracking();
      }
    } else {
      // Playing - handle async operations
      setIsPlaying(true);
      
      if (isPlayingAd && adAudioRef.current) {
        adAudioRef.current.play().catch(error => {
          console.error('🚫 Ad resume failed:', error);
          // Revert state if play fails
          setIsPlaying(false);
        });
      } else if (currentSong && audioRef.current) {
        audioRef.current.play().catch(error => {
          console.error('🚫 Song resume failed:', error);
          // Revert state if play fails
          setIsPlaying(false);
        });
      } else {
        // No current content, revert state since we can't play
        setIsPlaying(false);
      }
    }
  }, [isPlaying, isPlayingAd, currentSong, stopPlayTracking]);
  
  const seek = useCallback((time: number) => {
    if (audioRef.current && !isPlayingAd) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [isPlayingAd]);
  
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
  }, []);
  
  const addToQueue = useCallback((songs: Song[]) => {
    setQueue(prev => [...prev, ...songs]);
  }, []);
  
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);
  
  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const next = useCallback(() => {
    if (queue.length === 0) return;
    
    const currentIndex = currentSong ? queue.findIndex(song => song._id === currentSong._id) : -1;
    let nextIndex = currentIndex + 1;
    
    if (shuffle) {
      // Random song from queue
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeat === "all") {
        nextIndex = 0;
      } else {
        return; // End of queue
      }
    }
    
    play(queue[nextIndex]);
  }, [queue, currentSong, shuffle, repeat, play]);
  
  const previous = useCallback(() => {
    if (queue.length === 0) return;
    
    const currentIndex = currentSong ? queue.findIndex(song => song._id === currentSong._id) : -1;
    let prevIndex = currentIndex - 1;
    
    if (prevIndex < 0) {
      if (repeat === "all") {
        prevIndex = queue.length - 1;
      } else {
        return; // Start of queue
      }
    }
    
    play(queue[prevIndex]);
  }, [queue, currentSong, repeat, play]);
  
  const stop = useCallback(() => {
    pause();
    setCurrentSong(null);
    setCurrentAd(null);
    setIsPlayingAd(false);
    clearQueue();
  }, [pause, clearQueue]);
  
  const toggleShuffle = useCallback(() => {
    setShuffle(prev => !prev);
  }, []);
  
  const toggleRepeat = useCallback(() => {
    setRepeat(prev => {
      switch (prev) {
        case "none": return "all";
        case "all": return "one";
        case "one": return "none";
        default: return "none";
      }
    });
  }, []);
  
  const skipAd = useCallback(() => {
    if (!isPremium) {
      return;
    }
    
    if (isPlayingAd && currentSong) {
      setIsPlayingAd(false);
      setCurrentAd(null);
      
      if (adAudioRef.current) {
        adAudioRef.current.pause();
      }
      
      // Play the pending song
      if (audioRef.current && currentSong) {
        audioRef.current.src = currentSong.fileUrl;
        audioRef.current.load();
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(console.error);
      }
    }
  }, [isPlayingAd, currentSong, isPremium]);
  
  // Debug function to force play an ad for testing
  const forcePlayAd = useCallback(() => {
    if (!ads || ads.length === 0) {
      return;
    }
    
    const ad = ads[0];
    
    setCurrentAd(ad);
    setIsPlayingAd(true);
    
    if (adAudioRef.current) {
      adAudioRef.current.src = ad.audioUrl;
      adAudioRef.current.load();
      adAudioRef.current.play().then(() => {
        setIsPlaying(true);
        trackAdMutation.mutate(ad._id);
        incrementAdCount(ad._id);
      }).catch(error => {
        console.error('🚫 Force ad play failed:', error);
      });
    }
  }, [ads, trackAdMutation, incrementAdCount]);
  
  // Add debug functions to window
  useEffect(() => {
    (window as any).forcePlayAd = forcePlayAd;
    (window as any).testAdLogic = () => {
      // Test ad logic
    };
    (window as any).forcePlayNewestAd = () => {
      if (!ads || ads.length === 0) {
        return;
      }
      
      // Get the newest ad (last in array)
      const newestAd = ads[ads.length - 1];
      
      setCurrentAd(newestAd);
      setIsPlayingAd(true);
      
      if (adAudioRef.current) {
        adAudioRef.current.src = newestAd.audioUrl;
        adAudioRef.current.load();
        adAudioRef.current.play().then(() => {
          setIsPlaying(true);
          trackAdMutation.mutate(newestAd._id);
          incrementAdCount(newestAd._id);
        }).catch(error => {
          console.error('🚫 Newest ad play failed:', error);
        });
      }
    };
    (window as any).refreshAds = () => {
      refetchAds();
    };
  }, [forcePlayAd, refetchAds, ads, trackAdMutation, incrementAdCount]);
  
  // ✅ PERFORMANCE: Memoize context value to prevent unnecessary re-renders
  // Separate frequently updating values from stable values
  const stableValue = useMemo(() => ({
    // Control functions (rarely change)
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    next,
    previous,
    stop,
    addToQueue,
    clearQueue,
    removeFromQueue,
    toggleShuffle,
    toggleRepeat,
    skipAd,
    
    // Stable state (changes infrequently)
    currentSong,
    isPlaying,
    volume,
    queue,
    shuffle,
    repeat,
    isPlayingAd,
    currentAd,
  }), [
    play, pause, togglePlayPause, seek, setVolume, next, previous, stop,
    addToQueue, clearQueue, removeFromQueue, toggleShuffle, toggleRepeat, skipAd,
    currentSong, isPlaying, volume, queue, shuffle, repeat, isPlayingAd, currentAd
  ]);

  const frequentValue = useMemo(() => ({
    // Frequently updating values (isolated to minimize re-renders)
    currentTime,
    duration,
    progress,
  }), [currentTime, duration, progress]);

  const value: MusicPlayerContextType = useMemo(() => ({
    ...stableValue,
    ...frequentValue,
  }), [stableValue, frequentValue]);
  
  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
}