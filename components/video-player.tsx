"use client"

import { useEffect, useRef, useState, memo } from "react"
import { Play, Pause, Volume2, VolumeX, AlertCircle } from "lucide-react"

interface VideoPlayerProps {
  videoId: string
  isActive: boolean
  onVideoEnd: () => void
}

// Declare YT as a global variable to satisfy TypeScript
declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | null
    // Use any for YT to avoid type conflicts with YouTube API
    YT: any
    ytApiReady?: boolean // Optional flag to track API readiness
  }
}

// Create a custom event for token updates
const tokenUpdateEvent = new Event("tokenUpdate")

// Initialize YouTube API once for all players
const initializeYouTubeAPI = () => {
  if (window.YT) {
    window.ytApiReady = true;
    return Promise.resolve();
  }
  
  return new Promise<void>((resolve) => {
    // Add callback that will be called when API is loaded
    window.onYouTubeIframeAPIReady = () => {
      window.ytApiReady = true;
      resolve();
    };
    
    // Add YouTube API script if it doesn't exist
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });
};

// Call this on app initialization
if (typeof window !== 'undefined') {
  initializeYouTubeAPI();
}

function VideoPlayerComponent({ videoId, isActive, onVideoEnd }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTokenTimeRef = useRef<number>(0)
  const videoIdRef = useRef<string>(videoId) // Add a ref to track videoId changes

  // Initialize player when component mounts or videoId changes
  useEffect(() => {
    let isMounted = true;
    videoIdRef.current = videoId; // Update the ref
    setPlayerError(false);
    setIsLoading(true);
    
    // Always initialize all videos to ensure they're ready to play
    // This fixes the issue where videos below the first one weren't loading
    
    const initPlayer = async () => {
      if (!videoRef.current || !isMounted) return;
      
      try {
        // Wait for YouTube API to be ready
        if (!window.ytApiReady) {
          await initializeYouTubeAPI();
        }
        
        // Check if we already have a player initialized with this ID
        if (playerRef.current && playerRef.current.getVideoData && playerRef.current.getVideoData().video_id === videoId) {
          // Player already initialized with this video, just set ready
          setPlayerReady(true);
          setIsLoading(false);
          return;
        }
        
        // Ensure we have a valid video ID
        if (!videoId || videoId.length < 11) {
          console.error("Invalid video ID:", videoId);
          setPlayerError(true);
          setIsLoading(false);
          return;
        }
        
        // Create a div element for the player
        const playerElement = document.createElement("div");
        playerElement.id = `youtube-player-${videoId}`;
        videoRef.current.innerHTML = "";
        videoRef.current.appendChild(playerElement);
        
        // Create player with optimized options for faster loading
        playerRef.current = new window.YT.Player(playerElement.id, {
          height: "100%",
          width: "100%",
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3, // Hide video annotations
            modestbranding: 1,
            rel: 0, // Don't show related videos
            showinfo: 0,
            playsinline: 1,
            hl: 'en', // Set language to English
            cc_load_policy: 0, // Hide closed captions by default
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError,
          },
        });
      } catch (error) {
        console.error("Error initializing YouTube player:", error);
        if (isMounted) {
          setPlayerError(true);
          setIsLoading(false);
        }
      }
    };
    
    // Initialize immediately for all videos with a small stagger
    const initTimeout = setTimeout(() => {
      initPlayer();
    }, 100); // Small delay to prevent overwhelming the browser
    
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      // Clean up
      if (tokenTimerRef.current) {
        clearInterval(tokenTimerRef.current);
      }
    };
  }, [videoId]);

  // Add a separate effect to handle when isActive changes
  useEffect(() => {
    if (isActive && playerRef.current && playerReady) {
      // If this is now the active video and player is ready
      playerRef.current.cueVideoById(videoId);
    }
  }, [isActive, playerReady, videoId]);

  const onPlayerReady = (event: any) => {
    setPlayerReady(true);
    setDuration(event.target.getDuration());
    setIsLoading(false);

    // Set initial mute state
    if (isMuted) {
      event.target.mute();
    } else {
      event.target.unMute();
    }
    
    // Preload video for better performance if active
    if (isActive) {
      event.target.cueVideoById(videoId);
    }
  }

  const onPlayerStateChange = (event: any) => {
    const playerState = event.data;

    // Update playing state
    setIsPlaying(playerState === window.YT.PlayerState.PLAYING);
    
    // Hide loading indicator when video starts playing or is paused
    if (playerState === window.YT.PlayerState.PLAYING || 
        playerState === window.YT.PlayerState.PAUSED) {
      setIsLoading(false);
    }

    // Handle video end
    if (playerState === window.YT.PlayerState.ENDED) {
      stopTokenTimer();
      onVideoEnd();
    }

    // Start/stop token timer based on play state
    if (playerState === window.YT.PlayerState.PLAYING) {
      startTokenTimer();
    } else {
      stopTokenTimer();
    }
  }

  const onPlayerError = (event: any) => {
    console.error("YouTube player error:", event.data);
    setPlayerError(true);
    setIsLoading(false);
    stopTokenTimer();
  }

  // Handle intersection observer to load/unload videos when in viewport
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isActive && playerRef.current && playerReady) {
            // When element becomes visible and is the active video
            if (!isPlaying) {
              // Don't autoplay, just make sure it's loaded
              setCurrentTime(playerRef.current?.getCurrentTime() || 0);
            }
          } else if (!entry.isIntersecting && playerRef.current && isPlaying) {
            // If not visible and playing, pause to save resources
            playerRef.current.pauseVideo();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isActive, playerReady, isPlaying]);

  // Update current time while playing
  useEffect(() => {
    if (!isPlaying || !playerReady) return;

    const interval = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playerReady]);

  // Token timer functions
  const startTokenTimer = () => {
    if (tokenTimerRef.current) return;

    // Record the start time
    lastTokenTimeRef.current = Math.floor(Date.now() / 1000);

    tokenTimerRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const watchedSeconds = now - lastTokenTimeRef.current;

      // Award 1 token per minute (60 seconds)
      if (watchedSeconds >= 60) {
        const tokensToAward = Math.floor(watchedSeconds / 60);

        // Update tokens in localStorage
        const userData = localStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          user.tokens += tokensToAward;
          localStorage.setItem("user", JSON.stringify(user));

          // Dispatch event to update UI
          window.dispatchEvent(tokenUpdateEvent);
        }

        // Reset the timer
        lastTokenTimeRef.current = now - (watchedSeconds % 60);
      }
    }, 5000); // Check every 5 seconds
  }

  const stopTokenTimer = () => {
    if (tokenTimerRef.current) {
      clearInterval(tokenTimerRef.current);
      tokenTimerRef.current = null;
    }
  }

  const togglePlay = () => {
    if (!playerRef.current || !playerReady || playerError) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      setIsLoading(true);
      playerRef.current.playVideo();
    }
  }

  const toggleMute = () => {
    if (!playerRef.current || !playerReady || playerError) return;

    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="video-container bg-black">
        {playerError ? (
          <div className="w-full h-full bg-black flex items-center justify-center flex-col p-4">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-center text-sm">This video is unavailable. It may be private or removed.</p>
          </div>
        ) : (
          <>
            <div ref={videoRef} className="w-full h-full"></div>
            {isActive && isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlay}
              disabled={playerError}
              className={`w-8 h-8 flex items-center justify-center rounded-full ${
                playerError 
                  ? "bg-gray-700 cursor-not-allowed" 
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
            </button>
            <button
              onClick={toggleMute}
              disabled={playerError}
              className={`w-8 h-8 flex items-center justify-center rounded-full ${
                playerError 
                  ? "bg-gray-700 cursor-not-allowed" 
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
            </button>
            <div className="text-xs text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <div className="text-xs text-white/80 bg-primary/80 px-2 py-1 rounded-full">+1 VIDEO per minute</div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/20 mt-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}

// Memoize the component to avoid unnecessary re-renders
export default memo(VideoPlayerComponent);
