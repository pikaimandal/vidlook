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
  fetchMoreSearchResults,
  preloadCommonCategories,
  type Video
} from "@/lib/invidious-api"

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

// Define a constant for video count to keep it consistent
const VIDEOS_PER_PAGE = 12;
const LOAD_MORE_COUNT = 6;

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
  const [retryCount, setRetryCount] = useState(0)

  // Handle category change - fetch videos from API with more aggressive retry
  const handleCategoryChange = useCallback(async (category: VideoCategory) => {
    setActiveCategory(category)
    setLoading(true)
    setCurrentVideoIndex(0)
    setHasMoreVideos(true)
    setError(null)
    setSearchQuery("") // Clear search when changing category
    
    // Reset shown videos to improve loading behavior
    const fetchVideos = async (attempt = 0): Promise<void> => {
      try {
        console.log(`Fetching videos for category ${category}, attempt ${attempt + 1}`)
        const newVideos = await fetchVideosByCategory(category, VIDEOS_PER_PAGE, true);
        
        if (newVideos.length > 0) {
          setVideos(newVideos);
          setError(null);
        } else if (attempt < 2) { // Try up to 3 times
          console.warn(`No videos found on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 1000)); // Wait a second before retry
          await fetchVideos(attempt + 1);
        } else {
          setError("No videos found in this category. Please try another or reload the page.");
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
        
        if (attempt < 2) { // Try up to 3 times
          console.warn(`Error on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 1000)); // Wait a second before retry
          await fetchVideos(attempt + 1);
        } else {
          setError("Failed to load videos. Please check your internet connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    };
    
    await fetchVideos();
  }, []);

  // Handle search with optimized function
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      // Clear search and go back to current category
      handleCategoryChange(activeCategory);
      return;
    }
    
    setSearchLoading(true);
    setError(null);
    setCurrentVideoIndex(0); // Reset current video index when searching
    setHasMoreVideos(true); // Reset the hasMoreVideos state for new searches
    
    // Use the debounced search function to prevent excessive API calls
    debouncedSearchVideos(query, VIDEOS_PER_PAGE, (results) => {
      setVideos(results);
      setSearchLoading(false);
      if (results.length === 0) {
        setError("No videos found matching your search.");
        setHasMoreVideos(false);
      }
    });
  }, [activeCategory, handleCategoryChange]);

  // Add this new function to sync search state with VideoCategories
  const handleCategoryClick = useCallback((category: VideoCategory) => {
    // Always clear search state when changing categories
    setSearchQuery("");
    handleCategoryChange(category);
  }, [handleCategoryChange]);

  // Add function to handle manual refresh on error
  const handleRefresh = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
    
    try {
      const newVideos = await fetchVideosByCategory(activeCategory, VIDEOS_PER_PAGE, true);
      if (newVideos.length > 0) {
        setVideos(newVideos);
      } else {
        setError("Still unable to load videos. Please try again later.");
      }
    } catch (error) {
      console.error("Error during manual refresh:", error);
      setError("Failed to refresh videos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  // Initialize videos and preload common categories for better UX
  useEffect(() => {
    handleCategoryChange("Trending");
    
    // Preload other categories in the background for faster navigation
    preloadCommonCategories().catch(console.error);
  }, [handleCategoryChange]);

  // Set up infinite scroll with optimized loading
  useEffect(() => {
    if (loading || loadingMore || !hasMoreVideos) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        setLoadingMore(true);
        try {
          let newVideos: Video[] = [];
          
          // Use different fetch methods based on whether we're searching or browsing categories
          if (searchQuery) {
            // For search results
            newVideos = await fetchMoreSearchResults(searchQuery, LOAD_MORE_COUNT);
          } else {
            // For category browsing
            newVideos = await fetchMoreVideos(activeCategory, LOAD_MORE_COUNT);
          }
          
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

  // Handle video end - go to next video with improved logic
  const handleVideoEnd = useCallback(() => {
    // Only auto advance if not the last video
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
      
      // Scroll to the next video with a small delay to ensure DOM is updated
      setTimeout(() => {
        const videoElements = document.querySelectorAll(".video-card");
        if (videoElements[currentVideoIndex + 1]) {
          videoElements[currentVideoIndex + 1].scrollIntoView({ 
            behavior: "smooth",
            block: "center" 
          });
        }
      }, 100);
    } else if (videos.length > 0 && !loadingMore && hasMoreVideos) {
      // If at the last video, try to load more
      console.log("At last video, triggering load more");
      
      if (searchQuery) {
        // Load more search results
        fetchMoreSearchResults(searchQuery, LOAD_MORE_COUNT)
          .then(newVideos => {
            if (newVideos.length > 0) {
              setVideos(prev => [...prev, ...newVideos]);
            } else {
              setHasMoreVideos(false);
            }
          })
          .catch(err => {
            console.error("Failed to load more search results after last video ended:", err);
          });
      } else {
        // Load more category videos
        fetchMoreVideos(activeCategory, LOAD_MORE_COUNT)
          .then(newVideos => {
            if (newVideos.length > 0) {
              setVideos(prev => [...prev, ...newVideos]);
            } else {
              setHasMoreVideos(false);
            }
          })
          .catch(err => {
            console.error("Failed to load more videos after last video ended:", err);
          });
      }
    }
  }, [currentVideoIndex, videos.length, loadingMore, hasMoreVideos, activeCategory, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex justify-between items-center">
          <SearchBar 
            onSearch={handleSearch} 
            searchQuery={searchQuery}
          />
        </div>
        <VideoCategories activeCategory={activeCategory} onCategoryChange={handleCategoryClick} />
        <div className="flex justify-center my-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex justify-between items-center">
        <SearchBar 
          onSearch={handleSearch} 
          isLoading={searchLoading}
          searchQuery={searchQuery}
        />
      </div>
      
      <VideoCategories activeCategory={activeCategory} onCategoryChange={handleCategoryClick} />

      {error && (
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-center text-red-500">{error}</p>
          {searchQuery && (
            <button
              className="mt-4 text-primary hover:underline"
              onClick={() => handleCategoryClick(activeCategory)}
            >
              Return to {activeCategory} videos
            </button>
          )}
          <button
            className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
            onClick={handleRefresh}
          >
            Try Again
          </button>
        </div>
      )}

      {videos.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-center text-gray-400">No videos found.</p>
          {searchQuery && (
            <button
              className="mt-4 text-primary hover:underline"
              onClick={() => handleCategoryClick(activeCategory)}
            >
              Return to {activeCategory} videos
            </button>
          )}
          <button
            className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
            onClick={handleRefresh}
          >
            Reload Videos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video, index) => (
            <Card
              key={`${video.id}-${index}-${retryCount}`}
              className={`video-card bg-secondary/30 border-none overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                currentVideoIndex === index ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setCurrentVideoIndex(index)}
            >
              <CardContent className="p-0">
                <div className="relative w-full">
                  <VideoPlayer
                    videoId={video.id}
                    isActive={currentVideoIndex === index}
                    onVideoEnd={handleVideoEnd}
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-base mb-2 line-clamp-2">{video.title}</h3>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-400 mb-1">{video.channel}</span>
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
          <div ref={lastVideoElementRef} className="col-span-full h-16 flex justify-center items-center">
            {loadingMore && hasMoreVideos && (
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
