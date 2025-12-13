import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { APIRequest } from "@/lib/queryClient";
import type { Song, MusicPlayerState } from "@/types";

// Analytics tracking function - completely optional and non-blocking
const trackAnalytics = async (userId: string, action: string, metadata: any = {}) => {
  // Don't track analytics if no user
  if (!userId) return;
  
  try {
    // Use a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await APIRequest("POST", "/api/analytics/track", {
      userId,
      action,
      context: "player",
      metadata
    });

    clearTimeout(timeoutId);
    console.debug('✅ Analytics tracked:', action, 'for user:', userId);
  } catch (error) {
    // Analytics failures are completely silent and don't affect functionality
    console.debug("📊 Analytics tracking skipped:", error instanceof Error ? error.message : String(error));
  }
};

// Player authentication verification
const verifyPlayerAuth = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    // Quick token validation
    await APIRequest("GET", "/api/users/me");
    return true;
  } catch (error) {
    console.warn('🚫 Player auth verification failed:', error);
    return false;
  }
};

interface PlayerContextType extends MusicPlayerState {
  play: (song?: Song) => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (songs: Song[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCurrentTime: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [progress, setProgress] = useState<number>(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<'none' | 'one' | 'all'>('none');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTimeState] = useState<number>(0);
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);
  const previousUserRef = useRef<string | null>(null);

  // Reset player state when user changes (logout/login)
  useEffect(() => {
    const currentUserId = user?._id || null;
    const previousUserId = previousUserRef.current;
    
    console.log('🎵 Player: User auth state change detected:', {
      previousUserId,
      currentUserId,
      hasUser: !!user,
      isUserChange: previousUserId !== null && previousUserId !== currentUserId,
      userRole: user?.role
    });
    
    // If user changed (logout or different user login), completely reset player
    if (previousUserId !== null && previousUserId !== currentUserId) {
      console.log('🔄 Player: User changed, performing complete reset');
      
      // Stop and clean current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Force reload
        audioRef.current.currentTime = 0;
      }
      
      // Reset ALL player state to initial values
      setCurrentSong(null);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTimeState(0);
      setDuration(0);
      setQueue([]);
      setOriginalQueue([]);
      setCurrentIndex(0);
      setVolume(0.8); // Reset to default
      setShuffle(false);
      setRepeat('none');
      
      // Clear stored player data for the previous user
      localStorage.removeItem(STORAGE_KEYS.PLAYER_QUEUE);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
      
      // Reset the lastCurrentSongRef
      lastCurrentSongRef.current = null;
      
      console.log('✅ Player: Complete reset completed for user change');
    }
    
    // Update ref for next comparison
    previousUserRef.current = currentUserId;
  }, [user?._id]);

  // Refs to access current values in event handlers
  const repeatRef = useRef(repeat);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const lastCurrentSongRef = useRef<Song | null>(null);

  // Update refs when state changes
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    const audio = audioRef.current;

    // Audio event listeners
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime || 0;
      const duration = audio.duration || 0;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

      setCurrentTimeState(currentTime);
      setProgress(progress);
    };

    const handleEnded = () => {
      const currentRepeat = repeatRef.current;
      const currentQueue = queueRef.current;
      const currentIdx = currentIndexRef.current;

      if (currentRepeat === "one") {
        // Repeat current song
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
        return;
      }

      // Auto-advance to next song
      if (currentQueue.length > 0) {
        let nextIndex = currentIdx + 1;

        if (nextIndex >= currentQueue.length) {
          if (currentRepeat === "all") {
            nextIndex = 0; // Loop back to start
          } else {
            // End of queue
            setIsPlaying(false);
            setProgress(0);
            setCurrentTimeState(0);
            return;
          }
        }

        const nextSong = currentQueue[nextIndex];
        setCurrentIndex(nextIndex);
        setCurrentSong(nextSong);
        // Audio will auto-play due to useEffect below
      } else {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTimeState(0);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Load saved state
    const savedQueue = localStorage.getItem(STORAGE_KEYS.PLAYER_QUEUE);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.PLAYER_SETTINGS);

    if (savedQueue) {
      try {
        const parsedQueue = JSON.parse(savedQueue);
        setQueue(parsedQueue);
        setOriginalQueue(parsedQueue);
      } catch (error) {
        console.error('Failed to load saved queue:', error);
      }
    }

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setVolumeState(settings.volume || 0.8);
        setShuffle(settings.shuffle || false);
        setRepeat(settings.repeat || 'none');
        if (audioRef.current) {
          audioRef.current.volume = settings.volume || 0.8;
        }
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYER_QUEUE, JSON.stringify(queue));
    localStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify({
      volume: volume,
      shuffle: shuffle,
      repeat: repeat,
    }));
  }, [queue, volume, shuffle, repeat]);

  // Effect to play the song when currentSong or currentIndex changes
  useEffect(() => {
    if (currentSong && audioRef.current) {
      const audio = audioRef.current;
      const shouldSetSrc = lastCurrentSongRef.current?._id !== currentSong._id;
      
      console.log('Player effect triggered:', {
        songId: currentSong._id,
        title: currentSong.title,
        fileUrl: currentSong.fileUrl,
        shouldSetSrc,
        audioReady: !!audio,
        userAuthenticated: !!user
      });
      
      if (shouldSetSrc) {
        audio.src = currentSong.fileUrl;
        audio.load();
        lastCurrentSongRef.current = currentSong;

        // Track song play analytics (don't await to prevent blocking playback)
        // Track for authenticated users, or track anonymously for free users
        if (user?._id) {
          trackAnalytics(user._id, "play", {
            songId: currentSong._id,
            songTitle: currentSong.title,
            artistId: currentSong.artistId,
            userPlan: user.plan?.type || 'FREE'
          }).catch(() => {
            // Analytics failure shouldn't affect playback
          });
        } else {
          // For free users, we could track anonymous analytics if needed
          console.log('📊 Free user play - anonymous analytics could be tracked here');
        }
      }
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Playback started successfully for:', currentSong.title);
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('Failed to play audio:', error);
            setIsPlaying(false);
            
            // Check if it's an authentication issue
            if (error.message?.includes('401') || error.message?.includes('403')) {
              toast({
                title: "Authentication Error",
                description: "Please log in again to play music.",
                variant: "destructive"
              });
            } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
              toast({
                title: "Network Error",
                description: "Please check your internet connection and try again.",
                variant: "destructive"
              });
            } else {
              toast({
                title: "Playback Error",
                description: "Failed to play this track. The audio file may be corrupted or unavailable.",
                variant: "destructive"
              });
            }
          });
      } else {
        setIsPlaying(true);
      }
    }
  }, [currentSong, currentIndex, user]);

  const play = async (song?: Song) => {
    console.log('🎵 Player: Play function called:', {
      songId: song?._id,
      songTitle: song?.title,
      hasUser: !!user,
      userId: user?._id,
      userPlan: user?.plan?.type,
      currentSongId: currentSong?._id
    });

    if (song) {
      // Validate song has required fields
      const audioUrl = song.fileUrl;
      if (!audioUrl) {
        console.error('❌ Player: Song missing fileUrl:', song);
        toast({
          title: "Playback Error",
          description: "This song cannot be played - missing audio file.",
          variant: "destructive"
        });
        return;
      }

      // Allow playback for free users (they will see ads)
      // Only require authentication for premium users or when user context is needed
      if (!user?._id) {
        console.warn('⚠️ Player: No authenticated user - playing as free user with ads');
        // Free users can still play music, they just see ads
        // Don't return here, allow playback to continue
      } else {
        // Verify auth token is valid for authenticated users
        const authValid = await verifyPlayerAuth(user._id);
        if (!authValid) {
          console.error('❌ Player: Authentication verification failed for authenticated user');
          toast({
            title: "Authentication Expired",
            description: "Please log in again for full features.",
            variant: "destructive"
          });
          // Don't return - allow free playback with ads
        }
      }

      // Debug logging
      console.log('🎵 Player: Starting playback for song:', {
        songId: song._id,
        title: song.title,
        fileUrl: audioUrl,
        userId: user?._id || 'free-user',
        userPlan: user?.plan?.type || 'FREE'
      });

      // Find song in current queue or add it
      const songIndex = queue.findIndex(q => q._id === song._id);
      if (songIndex !== -1) {
        console.log('🎵 Player: Song found in queue at index:', songIndex);
        setCurrentIndex(songIndex);
        setCurrentSong(song);
      } else {
        console.log('🎵 Player: Adding song to queue');
        // Add to queue and set as current
        setQueue(prev => {
          const newQueue = [...prev, song];
          setCurrentIndex(newQueue.length - 1);
          return newQueue;
        });
        setCurrentSong(song);
      }
    } else if (currentSong && audioRef.current) {
      // Resume current song if no new song is provided
      // Allow resume for both authenticated and free users
      if (!user?._id) {
        console.warn('⚠️ Player: No authenticated user for resume - continuing as free user');
      } else {
        // Verify auth token for authenticated users
        const authValid = await verifyPlayerAuth(user._id);
        if (!authValid) {
          console.warn('⚠️ Player: Authentication verification failed for resume - continuing as free user');
        }
      }

      console.log('🎵 Player: Resuming playback for:', currentSong.title);

      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          console.log('✅ Player: Resume playback successful');
        } else {
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('❌ Player: Failed to resume audio:', error);
        setIsPlaying(false);
        
        let errorMessage = "Failed to resume playback";
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            errorMessage = "Audio playback blocked by browser. Please interact with the page first.";
          } else if (error.name === 'NotSupportedError') {
            errorMessage = "Audio format not supported";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: "Playback Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } else {
      console.warn('⚠️ Player: No song to play or resume');
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);

    // Track pause analytics (don't await to prevent blocking)
    if (user?._id && currentSong) {
      trackAnalytics(user._id, "pause", {
        songId: currentSong._id,
        currentTime: currentTime,
        userPlan: user.plan?.type || 'FREE'
      }).catch(() => {
        // Analytics failure shouldn't affect playback
      });
    }
  };

  const stop = () => {
    setCurrentSong(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTimeState(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
  };

  const next = () => {
    if (queue.length === 0) return;

    let nextIndex = currentIndex + 1;

    // Handle repeat modes
    if (repeat === "one") {
      // Stay on current song
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    if (nextIndex >= queue.length) {
      if (repeat === "all") {
        nextIndex = 0; // Loop back to start
      } else {
        // End of queue, stop playback
        stop();
        return;
      }
    }

    const nextSong = queue[nextIndex];
    setCurrentIndex(nextIndex);
    setCurrentSong(nextSong);
  };

  const previous = () => {
    if (queue.length === 0) return;

    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      if (repeat === "all") {
        prevIndex = queue.length - 1; // Loop to end
      } else {
        prevIndex = 0; // Stay at first song
      }
    }

    const prevSong = queue[prevIndex];
    setCurrentIndex(prevIndex);
    setCurrentSong(prevSong);
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTimeState(time);
    }
  };

  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setVolumeState(volume);
    }
  };

  const addToQueue = (songs: Song[]) => {
    setQueue(prev => {
      const newQueue = [...prev];
      songs.forEach(song => {
        if (!newQueue.find(q => q._id === song._id)) {
          newQueue.push(song);
        }
      });
      return newQueue;
    });

    toast({
      title: "Added to queue",
      description: `${songs.length} song(s) added to queue`
    });

    // Track add to queue analytics (don't await to prevent blocking)
    if (user?._id) {
      trackAnalytics(user._id, "add_to_playlist", {
        songsAdded: songs.length,
        totalQueueLength: queue.length + songs.length,
        userPlan: user.plan?.type || 'FREE'
      }).catch(() => {
        // Analytics failure shouldn't affect functionality
      });
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter((_, i) => i !== index);
      // Adjust currentIndex if the removed song was before the current song
      if (index < currentIndex) {
        setCurrentIndex(currentIndex - 1);
      } else if (index === currentIndex && newQueue.length > 0) {
        // If the current song is removed, play the next one if available
        const nextIndex = currentIndex < newQueue.length ? currentIndex : 0;
        setCurrentIndex(nextIndex);
        setCurrentSong(newQueue[nextIndex]);
      } else if (newQueue.length === 0) {
        stop();
      }
      return newQueue;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(0);
    stop();
  };

  const toggleShuffle = () => {
    const newShuffle = !shuffle;
    setShuffle(newShuffle);

    if (newShuffle) {
      // Save original queue order
      setOriginalQueue([...queue]);

      // Create shuffled queue
      const shuffled = [...queue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      setQueue(shuffled);
    } else {
      // Restore original queue order
      if (originalQueue.length > 0) {
        setQueue(originalQueue);
        // Find current song position in original queue
        if (currentSong) {
          const newIndex = originalQueue.findIndex(s => s._id === currentSong._id);
          if (newIndex !== -1) {
            setCurrentIndex(newIndex);
          }
        }
      }
    }
  };

  const toggleRepeat = () => {
    setRepeat(prevRepeat => {
      if (prevRepeat === 'none') return 'one';
      if (prevRepeat === 'one') return 'all';
      return 'none';
    });
  };

  const setCurrentTime = (time: number) => {
    setCurrentTimeState(time);
  };

  const contextValue: PlayerContextType = {
    currentSong,
    isPlaying,
    volume,
    progress,
    currentTime,
    duration,
    queue,
    shuffle,
    repeat,
    currentIndex,
    play,
    pause,
    stop,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setCurrentTime,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
