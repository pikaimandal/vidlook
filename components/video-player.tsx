"use client"

import { useEffect, useRef, useState, memo } from "react"
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2, Settings } from "lucide-react"
import { getVideoDetails } from "@/lib/invidious-api"
import { INVIDIOUS_CONFIG } from "@/lib/config"

interface VideoPlayerProps {
  videoId: string
  isActive: boolean
  onVideoEnd: () => void
}

// Create a custom event for token updates
const tokenUpdateEvent = new Event("tokenUpdate")

function VideoPlayerComponent({ videoId, isActive, onVideoEnd }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [directUrls, setDirectUrls] = useState<{[key: string]: string}>({})
  const [currentQuality, setCurrentQuality] = useState<string>('medium')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTokenTimeRef = useRef<number>(0)
  const videoIdRef = useRef<string>(videoId) // Add a ref to track videoId changes
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load video data and sources from Invidious API
  useEffect(() => {
    let isMounted = true
    videoIdRef.current = videoId
    setPlayerError(false)
    setIsLoading(true)
    setIsPlaying(false)
    setCurrentTime(0)
    
    const loadVideo = async () => {
      if (!isMounted) return
      
      try {
        const videoData = await getVideoDetails(videoId)
        
        if (!isMounted) return
        
        // Set video duration
        if (videoData.lengthSeconds) {
          setDuration(videoData.lengthSeconds)
        }
        
        // Get direct video URLs from formats
        const urls: {[key: string]: string} = {}
        
        // First try adaptive formats (better quality options)
        if (videoData.adaptiveFormats && videoData.adaptiveFormats.length > 0) {
          // Filter for video only formats (no audio)
          const videoFormats = videoData.adaptiveFormats.filter(
            (format: any) => format.type && format.type.startsWith('video/')
          )
          
          // Sort by quality (resolution)
          videoFormats.sort((a: any, b: any) => {
            const resA = a.resolution ? parseInt(a.resolution.split('p')[0], 10) : 0
            const resB = b.resolution ? parseInt(b.resolution.split('p')[0], 10) : 0
            return resB - resA // Higher resolution first
          })
          
          // Map qualities
          for (const format of videoFormats) {
            if (format.resolution) {
              const quality = getQualityLabel(format.resolution)
              if (quality && format.url) {
                urls[quality] = format.url
              }
            }
          }
        }
        
        // Fallback to format streams if no adaptive formats
        if (Object.keys(urls).length === 0 && videoData.formatStreams && videoData.formatStreams.length > 0) {
          for (const format of videoData.formatStreams) {
            if (format.resolution) {
              const quality = getQualityLabel(format.resolution)
              if (quality && format.url) {
                urls[quality] = format.url
              }
            }
          }
        }
        
        // If we have HLS url, use that as a fallback
        if (videoData.hlsUrl) {
          urls['hls'] = videoData.hlsUrl
        }
        
        if (Object.keys(urls).length === 0) {
          setPlayerError(true)
          console.error("No playable video formats found")
        } else {
          setDirectUrls(urls)
          
          // Determine best initial quality based on what's available
          let initialQuality = 'medium'
          if (urls['medium']) {
            initialQuality = 'medium'
          } else if (urls['high']) {
            initialQuality = 'high'
          } else if (urls['low']) {
            initialQuality = 'low'
          } else {
            // Just use the first available quality
            initialQuality = Object.keys(urls)[0]
          }
          
          setCurrentQuality(initialQuality)
          setPlayerReady(true)
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading video from Invidious:", error)
        if (isMounted) {
          setPlayerError(true)
          setIsLoading(false)
        }
      }
    }
    
    loadVideo()
    
    return () => {
      isMounted = false
      // Clean up
      if (tokenTimerRef.current) {
        clearInterval(tokenTimerRef.current)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [videoId])

  // Helper to map resolution to quality label
  const getQualityLabel = (resolution: string): string | null => {
    const res = parseInt(resolution.split('p')[0], 10)
    if (res >= 1080) return 'high'
    if (res >= 720) return 'medium'
    if (res >= 360) return 'low'
    if (res >= 240) return 'lowest'
    return null
  }

  // Handle video element events
  useEffect(() => {
    if (!videoRef.current || !playerReady || !isActive) return
    
    const video = videoRef.current
    
    const handlePlay = () => {
      setIsPlaying(true)
      startTokenTimer()
    }
    
    const handlePause = () => {
      setIsPlaying(false)
      stopTokenTimer()
    }
    
    const handleEnded = () => {
      setIsPlaying(false)
      stopTokenTimer()
      onVideoEnd()
    }
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }
    
    const handleError = (e: any) => {
      console.error("Video playback error:", e)
      setPlayerError(true)
      stopTokenTimer()
    }
    
    // Add event listeners
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('error', handleError)
    
    // Set initial mute state
    video.muted = isMuted
    
    return () => {
      // Remove event listeners
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('error', handleError)
    }
  }, [playerReady, isActive, isMuted, onVideoEnd])

  // Handle playing when active status changes
  useEffect(() => {
    if (isActive && videoRef.current && playerReady && directUrls[currentQuality]) {
      // If this is now the active video and player is ready
      if (!videoRef.current.paused) {
        // If already playing, do nothing
        return
      }
      
      // Preload but don't autoplay
      videoRef.current.load()
    } else if (!isActive && videoRef.current && isPlaying) {
      // If no longer active but playing, pause
      videoRef.current.pause()
    }
  }, [isActive, playerReady, isPlaying, directUrls, currentQuality])

  // Update video source when quality changes
  useEffect(() => {
    if (videoRef.current && playerReady && directUrls[currentQuality]) {
      const wasPlaying = !videoRef.current.paused
      const currentVideoTime = videoRef.current.currentTime
      
      // Set new source
      videoRef.current.src = directUrls[currentQuality]
      videoRef.current.load()
      
      // Restore time
      videoRef.current.currentTime = currentVideoTime
      
      // Resume if it was playing
      if (wasPlaying && isActive) {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Error resuming playback after quality change:", e)
          })
        }
      }
    }
  }, [currentQuality, playerReady, directUrls, isActive])

  // Handle intersection observer
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isActive && videoRef.current && playerReady) {
            // When element becomes visible and is the active video
            if (!isPlaying && directUrls[currentQuality]) {
              // Load but don't autoplay
              videoRef.current.load()
            }
          } else if (!entry.isIntersecting && videoRef.current && isPlaying) {
            // If not visible and playing, pause to save resources
            videoRef.current.pause()
          }
        })
      },
      { threshold: 0.3 }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isActive, playerReady, isPlaying, directUrls, currentQuality])

  // Handle clicks outside quality menu to close it
  useEffect(() => {
    if (!showQualityMenu) return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Element && 
        !event.target.closest('.quality-menu') && 
        !event.target.closest('.quality-button')
      ) {
        setShowQualityMenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showQualityMenu])

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
    if (!videoRef.current || !playerReady || playerError) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      setIsLoading(true)
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsLoading(false)
          })
          .catch(error => {
            console.error("Play error:", error)
            setIsLoading(false)
            // If autoplay was prevented, we can try again with user interaction
            if (error.name === "NotAllowedError") {
              console.warn("Autoplay prevented, user must interact")
            }
          })
      }
    }
  }

  const toggleMute = () => {
    if (!videoRef.current || !playerReady || playerError) return

    if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    } else {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Quality change handler
  const changeQuality = (quality: string) => {
    if (quality !== currentQuality && directUrls[quality]) {
      setCurrentQuality(quality)
      setShowQualityMenu(false)
    }
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
            <video 
              ref={videoRef}
              className="w-full h-full"
              preload="metadata"
              playsInline
              src={playerReady ? directUrls[currentQuality] : undefined}
            />
            
            {isActive && isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
            
            {/* Quality selection button */}
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                disabled={playerError || !playerReady}
                className={`quality-button w-8 h-8 flex items-center justify-center rounded-full ${
                  playerError || !playerReady
                    ? "bg-gray-700 cursor-not-allowed" 
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <Settings className="h-4 w-4 text-white" />
              </button>

              {/* Quality menu */}
              {showQualityMenu && (
                <div className="quality-menu absolute bottom-full left-0 mb-2 bg-black/90 rounded p-2 w-28 z-20 shadow-lg">
                  <p className="text-xs text-gray-400 mb-1 border-b border-gray-800 pb-1">Quality</p>
                  {Object.keys(directUrls).map(quality => (
                    <button 
                      key={quality}
                      onClick={() => changeQuality(quality)}
                      className={`block w-full text-left text-xs py-1 px-2 rounded hover:bg-white/10 ${
                        quality === currentQuality ? 'text-primary' : 'text-white'
                      }`}
                    >
                      {quality === 'high' ? 'High (1080p)' 
                        : quality === 'medium' ? 'Medium (720p)' 
                        : quality === 'low' ? 'Low (480p)' 
                        : quality === 'lowest' ? 'Lowest (360p)'
                        : quality === 'hls' ? 'Auto (HLS)'
                        : quality}
                    </button>
                  ))}
                </div>
              )}
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
