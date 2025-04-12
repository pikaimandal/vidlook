"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import VideoPlayer from "@/components/video-player"
import SearchBar from "@/components/search-bar"
import VideoCategories, { type VideoCategory } from "@/components/video-categories"
import { fetchVideosByCategory, fetchMoreVideos, searchVideos, YOUTUBE_CATEGORIES } from "@/lib/youtube-api"
import { Video } from "@/types/video"

// We'll keep a smaller set of hardcoded videos as backup in case the API fails
const FALLBACK_VIDEOS = {
  Trending: [
    {
      id: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
      channel: "Rick Astley",
      views: "1.2B views",
      timestamp: "14 years ago",
    },
  ],
  Gaming: [
    {
      id: "8X2kIfS6fb8",
      title: "GTA 6 Trailer 1",
      channel: "Rockstar Games",
      views: "175M views",
      timestamp: "4 months ago",
    },
  ],
};

export default function VideoFeed() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<VideoCategory>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const observer = useRef<IntersectionObserver | null>(null)
  const lastVideoElementRef = useRef<HTMLDivElement | null>(null)
  const [hasMoreVideos, setHasMoreVideos] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Handle category change - fetch videos from API
  const handleCategoryChange = async (category: VideoCategory) => {
    setActiveCategory(category)
    setLoading(true)
    setCurrentVideoIndex(0)
    setHasMoreVideos(true)

    try {
      const newVideos = await fetchVideosByCategory(category, 10, true);
      setVideos(newVideos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      // Fallback to hardcoded videos if API fails
      const fallbackCategory = FALLBACK_VIDEOS[category as keyof typeof FALLBACK_VIDEOS] || FALLBACK_VIDEOS.Trending;
      setVideos(fallbackCategory);
    } finally {
      setLoading(false);
    }
  }

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    setLoading(true)
    setCurrentVideoIndex(0)
    setHasMoreVideos(true)

    if (!query) {
      handleCategoryChange(activeCategory)
      return
    }

    try {
      const searchResults = await searchVideos(query, 20);
      setVideos(searchResults);
    } catch (error) {
      console.error("Error searching videos:", error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  // Initialize videos
  useEffect(() => {
    handleCategoryChange("All")
  }, [])

  // Set up infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMoreVideos) return

    if (observer.current) observer.current.disconnect()

    observer.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !searchQuery) {
        setLoadingMore(true)
        try {
          // Fetch more videos when user scrolls to the bottom
          const newVideos = await fetchMoreVideos(activeCategory, 5);
          
          if (newVideos.length === 0) {
            setHasMoreVideos(false);
          } else {
            setVideos((prevVideos) => [...prevVideos, ...newVideos]);
          }
        } catch (error) {
          console.error("Error loading more videos:", error);
          setHasMoreVideos(false);
        } finally {
          setLoadingMore(false);
        }
      }
    })

    if (lastVideoElementRef.current) {
      observer.current.observe(lastVideoElementRef.current)
    }

    return () => {
      if (observer.current) observer.current.disconnect()
    }
  }, [videos, loading, activeCategory, searchQuery, loadingMore, hasMoreVideos])

  // Handle video end - go to next video
  const handleVideoEnd = () => {
    // Only auto advance if not the last video
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex((prev) => prev + 1)
      
      // Scroll to the next video
      const videoElements = document.querySelectorAll(".video-card")
      if (videoElements[currentVideoIndex + 1]) {
        videoElements[currentVideoIndex + 1].scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex justify-between items-center">
          <SearchBar onSearch={handleSearch} />
        </div>
        <VideoCategories activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
        <div className="flex justify-center my-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex justify-between items-center">
        <SearchBar onSearch={handleSearch} />
      </div>
      
      <VideoCategories activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-center text-gray-400">No videos found.</p>
          {searchQuery && (
            <button
              className="mt-4 text-primary hover:underline"
              onClick={() => handleCategoryChange(activeCategory)}
            >
              Return to {activeCategory} videos
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {videos.map((video, index) => (
            <Card
              key={`${video.id}-${index}`}
              className={`video-card bg-secondary/30 border-none overflow-hidden ${
                currentVideoIndex === index ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardContent className="p-0">
                <div className="aspect-video relative">
                  <VideoPlayer
                    videoId={video.id}
                    isActive={currentVideoIndex === index}
                    onVideoEnd={handleVideoEnd}
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-medium mb-1 line-clamp-2">{video.title}</h3>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-400">{video.channel}</span>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>{video.views}</span>
                      <span className="mx-1">•</span>
                      <span>{video.timestamp}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Loading indicator at the bottom for infinite scroll */}
          <div ref={lastVideoElementRef} className="h-8 flex justify-center">
            {loadingMore && hasMoreVideos && (
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
