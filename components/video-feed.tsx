"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import VideoPlayer from "@/components/video-player"
import SearchBar from "@/components/search-bar"
import VideoCategories, { type VideoCategory } from "@/components/video-categories"
import { 
  fetchVideosByCategory, 
  fetchMoreVideos, 
  debouncedSearchVideos,
  preloadCommonCategories
} from "@/lib/youtube-api"
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
  const [searchLoading, setSearchLoading] = useState(false)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<VideoCategory>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const observer = useRef<IntersectionObserver | null>(null)
  const lastVideoElementRef = useRef<HTMLDivElement | null>(null)
  const [hasMoreVideos, setHasMoreVideos] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle category change - fetch videos from API
  const handleCategoryChange = useCallback(async (category: VideoCategory) => {
    setActiveCategory(category)
    setLoading(true)
    setCurrentVideoIndex(0)
    setHasMoreVideos(true)
    setError(null)
    setSearchQuery("") // Clear search when changing category

    try {
      const newVideos = await fetchVideosByCategory(category, 10, true);
      setVideos(newVideos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setError("Failed to load videos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search with optimized function
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      handleCategoryChange(activeCategory);
      return;
    }
    
    setSearchLoading(true);
    setError(null);
    
    // Use the debounced search function to prevent excessive API calls
    debouncedSearchVideos(query, (results) => {
      setVideos(results);
      setSearchLoading(false);
      if (results.length === 0) {
        setError("No videos found matching your search.");
      }
    });
  }, [activeCategory, handleCategoryChange]);

  // Initialize videos and preload common categories for better UX
  useEffect(() => {
    handleCategoryChange("All");
    
    // Preload other categories in the background for faster navigation
    preloadCommonCategories().catch(console.error);
  }, [handleCategoryChange]);

  // Set up infinite scroll with optimized loading
  useEffect(() => {
    if (loading || loadingMore || !hasMoreVideos || searchQuery) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        setLoadingMore(true);
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
    }, {
      rootMargin: '200px', // Load videos before user reaches the bottom
      threshold: 0.1
    });

    if (lastVideoElementRef.current) {
      observer.current.observe(lastVideoElementRef.current);
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [videos, loading, activeCategory, searchQuery, loadingMore, hasMoreVideos]);

  // Handle video end - go to next video
  const handleVideoEnd = useCallback(() => {
    // Only auto advance if not the last video
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex((prev) => prev + 1);
      
      // Scroll to the next video
      const videoElements = document.querySelectorAll(".video-card");
      if (videoElements[currentVideoIndex + 1]) {
        videoElements[currentVideoIndex + 1].scrollIntoView({ 
          behavior: "smooth",
          block: "center" 
        });
      }
    }
  }, [currentVideoIndex, videos.length]);

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
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex justify-between items-center">
        <SearchBar onSearch={handleSearch} isLoading={searchLoading} />
      </div>
      
      <VideoCategories activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />

      {error && (
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-center text-red-500">{error}</p>
          {searchQuery && (
            <button
              className="mt-4 text-primary hover:underline"
              onClick={() => handleCategoryChange(activeCategory)}
            >
              Return to {activeCategory} videos
            </button>
          )}
        </div>
      )}

      {videos.length === 0 && !error ? (
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
  );
}
