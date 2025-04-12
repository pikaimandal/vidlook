// YouTube API integration for VidLook
// Production implementation using YouTube Data API v3

import { Video, YouTubeApiResponse, YouTubeVideoItem } from "@/types/video";

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

// Check if API key is available
if (!YOUTUBE_API_KEY) {
  console.warn("YouTube API key is not set. Please add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file.");
}

// Cache mechanism to avoid repeated API calls
const videoCache: Record<string, Video[]> = {};
let nextPageTokens: Record<string, string | null> = {};

// YouTube Categories mapped to YouTube API category IDs
export const YOUTUBE_CATEGORIES = {
  All: null, // Special case for mixed content
  Trending: null, // Special case for trending videos
  Music: "10",
  Gaming: "20",
  News: "25",
  Movies: "1", // Film & Animation
  Sports: "17",
  Technology: "28",
};

// Format a YouTube API response item to our Video interface
const formatVideoItem = (item: YouTubeVideoItem): Video => {
  return {
    id: typeof item.id === 'string' ? item.id : item.id?.videoId || "",
    title: item.snippet?.title || "Untitled Video",
    channel: item.snippet?.channelTitle || "Unknown Channel",
    views: item.statistics?.viewCount ? formatViewCount(item.statistics.viewCount) : "Loading...",
    timestamp: item.snippet?.publishedAt ? formatTimeAgo(new Date(item.snippet.publishedAt)) : "",
  };
};

// Format view count to a readable format
const formatViewCount = (viewCount: string): string => {
  const count = parseInt(viewCount, 10);
  if (isNaN(count)) return "0 views";
  
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  } else {
    return `${count} views`;
  }
};

// Format a date to "x time ago" format
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} days ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} years ago`;
};

// Function to fetch videos by category
export const fetchVideosByCategory = async (
  category: string,
  count: number = 10,
  resetCache: boolean = false
): Promise<Video[]> => {
  const cacheKey = `category_${category}`;
  
  // Clear the cache if requested or if we're starting a new category
  if (resetCache) {
    videoCache[cacheKey] = [];
    nextPageTokens[cacheKey] = null;
  }
  
  // If we have enough cached videos, return them
  if (videoCache[cacheKey] && videoCache[cacheKey].length >= count) {
    return videoCache[cacheKey].slice(0, count);
  }
  
  try {
    let newVideos: Video[] = [];
    
    if (category === "All") {
      // For "All" category, fetch a mix of popular videos
      const response = await fetch(
        `${YOUTUBE_API_URL}/videos?part=snippet,statistics&chart=mostPopular&maxResults=${count}&key=${YOUTUBE_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }
      
      const data: YouTubeApiResponse = await response.json();
      newVideos = data.items.map(formatVideoItem);
      nextPageTokens[cacheKey] = data.nextPageToken || null;
      
    } else if (category === "Trending") {
      // For trending, we also use mostPopular but with a smaller result set
      const response = await fetch(
        `${YOUTUBE_API_URL}/videos?part=snippet,statistics&chart=mostPopular&maxResults=${count}&key=${YOUTUBE_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }
      
      const data: YouTubeApiResponse = await response.json();
      newVideos = data.items.map(formatVideoItem);
      nextPageTokens[cacheKey] = data.nextPageToken || null;
      
    } else {
      // For specific categories, use the videoCategoryId
      const categoryId = YOUTUBE_CATEGORIES[category as keyof typeof YOUTUBE_CATEGORIES];
      if (categoryId) {
        const response = await fetch(
          `${YOUTUBE_API_URL}/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=${categoryId}&maxResults=${count}${
            nextPageTokens[cacheKey] ? `&pageToken=${nextPageTokens[cacheKey]}` : ""
          }&key=${YOUTUBE_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`YouTube API error: ${response.statusText}`);
        }
        
        const data: YouTubeApiResponse = await response.json();
        newVideos = data.items.map(formatVideoItem);
        nextPageTokens[cacheKey] = data.nextPageToken || null;
      }
    }
    
    // Cache the results
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    // Add new videos to cache
    videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
    
    return videoCache[cacheKey].slice(0, count);
    
  } catch (error) {
    console.error("Error fetching videos:", error);
    return [];
  }
};

// Function to fetch more videos for the current category
export const fetchMoreVideos = async (
  category: string,
  count: number = 10
): Promise<Video[]> => {
  const cacheKey = `category_${category}`;
  const currentCount = videoCache[cacheKey]?.length || 0;
  
  try {
    // If we don't have a next page token, we can't fetch more videos
    if (!nextPageTokens[cacheKey] && currentCount > 0) {
      return [];
    }
    
    let newVideos: Video[] = [];
    
    if (category === "All" || category === "Trending") {
      // For "All" or "Trending" category, fetch a mix of popular videos
      const response = await fetch(
        `${YOUTUBE_API_URL}/videos?part=snippet,statistics&chart=mostPopular&maxResults=${count}${
          nextPageTokens[cacheKey] ? `&pageToken=${nextPageTokens[cacheKey]}` : ""
        }&key=${YOUTUBE_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }
      
      const data: YouTubeApiResponse = await response.json();
      newVideos = data.items.map(formatVideoItem);
      nextPageTokens[cacheKey] = data.nextPageToken || null;
      
    } else {
      // For specific categories, use the videoCategoryId
      const categoryId = YOUTUBE_CATEGORIES[category as keyof typeof YOUTUBE_CATEGORIES];
      if (categoryId) {
        const response = await fetch(
          `${YOUTUBE_API_URL}/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=${categoryId}&maxResults=${count}${
            nextPageTokens[cacheKey] ? `&pageToken=${nextPageTokens[cacheKey]}` : ""
          }&key=${YOUTUBE_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`YouTube API error: ${response.statusText}`);
        }
        
        const data: YouTubeApiResponse = await response.json();
        newVideos = data.items.map(formatVideoItem);
        nextPageTokens[cacheKey] = data.nextPageToken || null;
      }
    }
    
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    // Add new videos to cache
    videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
    
    // Return only the newly added videos
    return videoCache[cacheKey].slice(currentCount);
    
  } catch (error) {
    console.error("Error loading more videos:", error);
    return [];
  }
};

// Function to search for videos
export const searchVideos = async (query: string, count: number = 20): Promise<Video[]> => {
  const cacheKey = `search_${query}`;
  
  // If we have cached results for this search, return them
  if (videoCache[cacheKey]) {
    return videoCache[cacheKey];
  }
  
  try {
    // Make a real search API call
    const response = await fetch(
      `${YOUTUBE_API_URL}/search?part=snippet&q=${encodeURIComponent(
        query
      )}&maxResults=${count}&type=video&key=${YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }
    
    const data: YouTubeApiResponse = await response.json();
    
    // For search results, we need to make a second API call to get video statistics
    const videoIds = data.items.map((item: any) => item.id.videoId).join(",");
    
    if (!videoIds) {
      return [];
    }
    
    const videosResponse = await fetch(
      `${YOUTUBE_API_URL}/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!videosResponse.ok) {
      throw new Error(`YouTube API error: ${videosResponse.statusText}`);
    }
    
    const videosData: YouTubeApiResponse = await videosResponse.json();
    const videos = videosData.items.map(formatVideoItem);
    
    // Cache the results
    videoCache[cacheKey] = videos;
    
    return videos;
    
  } catch (error) {
    console.error("Error searching videos:", error);
    return [];
  }
}; 