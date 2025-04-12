"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, VolumeX, AlertCircle } from "lucide-react"

interface VideoPlayerProps {
  videoId: string
  isActive: boolean
  onVideoEnd: () => void
}

// Declare YT as a global variable to satisfy TypeScript
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

// Create a custom event for token updates
const tokenUpdateEvent = new Event("tokenUpdate")

export default function VideoPlayer({ videoId, isActive, onVideoEnd }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState(false)
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTokenTimeRef = useRef<number>(0)

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      // Add YouTube API script if it doesn't exist
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    // Initialize player when API is ready
    window.onYouTubeIframeAPIReady = initializePlayer

    // If YT is already loaded, initialize player directly
    if (window.YT && window.YT.Player) {
      initializePlayer()
    }

    return () => {
      // Clean up
      if (tokenTimerRef.current) {
        clearInterval(tokenTimerRef.current)
      }
    }
  }, [videoId])

  const initializePlayer = () => {
    if (!videoRef.current) return

    // Reset error state when initializing a new player
    setPlayerError(false)
    
    // Set a valid default video ID if the current one is invalid
    // YouTube video IDs are typically 11 characters long
    const validVideoId = videoId && videoId.length >= 11 ? videoId : "dQw4w9WgXcQ";

    // Create a div element for the player
    const playerElement = document.createElement("div")
    playerElement.id = `youtube-player-${validVideoId}`
    videoRef.current.innerHTML = ""
    videoRef.current.appendChild(playerElement)

    try {
      playerRef.current = new window.YT.Player(playerElement.id, {
        height: "100%",
        width: "100%",
        videoId: validVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      })
    } catch (error) {
      console.error("Error initializing YouTube player:", error);
      setPlayerError(true);
    }
  }

  const onPlayerReady = (event: any) => {
    setPlayerReady(true)
    setDuration(event.target.getDuration())

    // Set initial mute state
    if (isMuted) {
      event.target.mute()
    } else {
      event.target.unMute()
    }
  }

  const onPlayerStateChange = (event: any) => {
    const playerState = event.data

    // Update playing state
    setIsPlaying(playerState === window.YT.PlayerState.PLAYING)

    // Handle video end
    if (playerState === window.YT.PlayerState.ENDED) {
      stopTokenTimer()
      onVideoEnd()
    }

    // Start/stop token timer based on play state
    if (playerState === window.YT.PlayerState.PLAYING) {
      startTokenTimer()
    } else {
      stopTokenTimer()
    }
  }

  const onPlayerError = (event: any) => {
    console.error("YouTube player error:", event.data);
    setPlayerError(true);
    stopTokenTimer();
  }

  // Handle intersection observer to play/pause videos when in viewport
  useEffect(() => {
    if (!containerRef.current || !playerReady) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isActive) {
            // Don't autoplay, just make sure it's visible
            setCurrentTime(playerRef.current?.getCurrentTime() || 0)
          } else {
            // If not visible, pause the video
            if (playerRef.current && isPlaying) {
              playerRef.current.pauseVideo()
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isActive, playerReady, isPlaying])

  // Update current time
  useEffect(() => {
    if (!isPlaying || !playerReady) return

    const interval = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, playerReady])

  // Token timer functions
  const startTokenTimer = () => {
    if (tokenTimerRef.current) return

    // Record the start time
    lastTokenTimeRef.current = Math.floor(Date.now() / 1000)

    tokenTimerRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const watchedSeconds = now - lastTokenTimeRef.current

      // Award 1 token per minute (60 seconds)
      if (watchedSeconds >= 60) {
        const tokensToAward = Math.floor(watchedSeconds / 60)

        // Update tokens in localStorage
        const userData = localStorage.getItem("user")
        if (userData) {
          const user = JSON.parse(userData)
          user.tokens += tokensToAward
          localStorage.setItem("user", JSON.stringify(user))

          // Dispatch event to update UI
          window.dispatchEvent(tokenUpdateEvent)
        }

        // Reset the timer
        lastTokenTimeRef.current = now - (watchedSeconds % 60)
      }
    }, 5000) // Check every 5 seconds
  }

  const stopTokenTimer = () => {
    if (tokenTimerRef.current) {
      clearInterval(tokenTimerRef.current)
      tokenTimerRef.current = null
    }
  }

  const togglePlay = () => {
    if (!playerRef.current || !playerReady || playerError) return

    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  const toggleMute = () => {
    if (!playerRef.current || !playerReady || playerError) return

    if (isMuted) {
      playerRef.current.unMute()
      setIsMuted(false)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="video-container">
        {playerError ? (
          <div className="w-full h-full bg-black flex items-center justify-center flex-col p-4">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-center text-sm">This video is unavailable. It may be private or removed.</p>
          </div>
        ) : (
          <div ref={videoRef} className="w-full h-full"></div>
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
