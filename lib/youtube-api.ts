// YouTube API integration for VidLook
// Production implementation using YouTube Data API v3

// Define types directly here to fix import issues
export interface Video {
  id: string;
  title: string;
  channel: string;
  views: string;
  timestamp: string;
}

export interface YouTubeApiResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeVideoItem[];
}

export interface YouTubeVideoItem {
  kind: string;
  etag: string;
  id: string | { kind: string; videoId: string; };
  snippet?: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    tags?: string[];
    categoryId?: string;
    liveBroadcastContent?: string;
    defaultLanguage?: string;
    localized?: {
      title: string;
      description: string;
    };
    defaultAudioLanguage?: string;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    favoriteCount: string;
    commentCount: string;
  };
}

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

// Check if API key is available
if (!YOUTUBE_API_KEY) {
  console.error(
    "YouTube API key is missing. Add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file. " +
    "The app will attempt to connect to YouTube but may fail due to API limits."
  );
}

// Cache mechanism to avoid repeated API calls
const videoCache: Record<string, Video[]> = {};
let nextPageTokens: Record<string, string | null> = {};

// Cache expiration time (15 minutes)
const CACHE_EXPIRATION = 15 * 60 * 1000;
const cacheTimestamps: Record<string, number> = {};

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

// Preload common categories to improve perceived performance
export const preloadCommonCategories = async (): Promise<void> => {
  // Preload trending videos in the background
  try {
    await fetchVideosByCategory("Trending", 5, true);
    console.log("Preloaded trending videos");
  } catch (error) {
    console.error("Error preloading trending videos:", error);
  }
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

// Check if cache is expired
const isCacheExpired = (cacheKey: string): boolean => {
  if (!cacheTimestamps[cacheKey]) return true;
  return Date.now() - cacheTimestamps[cacheKey] > CACHE_EXPIRATION;
};

// Enhanced fetch function with optimized parameters and ad filtering
const fetchFromYouTubeAPI = async (endpoint: string, params: Record<string, string>, retries = 2): Promise<YouTubeApiResponse> => {
  // Add API key to params
  const queryParams = new URLSearchParams({
    ...params,
    key: YOUTUBE_API_KEY || "",
  });
  
  // Create the URL
  const url = `${YOUTUBE_API_URL}/${endpoint}?${queryParams.toString()}`;
  
  // Fetch with timeout to avoid hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`YouTube API error (${response.status}): ${errorText}`);
      
      if (retries > 0 && (response.status === 403 || response.status === 429)) {
        // If rate limited, wait and retry with exponential backoff
        const delay = 1000 * (3 - retries); // 1s, 2s delay based on retry count
        console.warn(`Rate limited by YouTube API, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchFromYouTubeAPI(endpoint, params, retries - 1);
      }
      
      throw new Error(`YouTube API error: ${response.statusText}`);
    }
    
    const data: YouTubeApiResponse = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      console.error('YouTube API request timed out');
      
      if (retries > 0) {
        console.warn(`Retrying after timeout (${retries} attempts left)...`);
        return fetchFromYouTubeAPI(endpoint, params, retries - 1);
      }
      
      throw new Error('Request timed out after multiple attempts');
    }
    throw error;
  }
};

// Function to filter out videos that might be ads or inappropriate
const filterAdsAndPoorContent = (videos: Video[]): Video[] => {
  // Keywords that might indicate promotional/ad content
  const adKeywords = [
    'promo', 'promotion', 'sponsor', 'ad:', 'ads:', 'advertisement', 
    'deal', 'buy now', 'limited time offer', 'subscribe'
  ];
  
  return videos.filter(video => {
    const titleLower = video.title.toLowerCase();
    
    // Filter videos with potential ad-related keywords
    const hasAdKeywords = adKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
    
    // Also filter very short videos (< 30 seconds) which might be ads
    // Note: We can't reliably check duration here without extra API calls
    
    return !hasAdKeywords;
  });
};

// Function to fetch videos by category
export const fetchVideosByCategory = async (
  category: string,
  count: number = 10,
  resetCache: boolean = false
): Promise<Video[]> => {
  const cacheKey = `category_${category}`;
  
  // Force bypassing cache if requested to ensure fresh videos
  if (resetCache || isCacheExpired(cacheKey)) {
    videoCache[cacheKey] = [];
    nextPageTokens[cacheKey] = null;
  }
  
  // If we have enough cached videos, return them
  if (videoCache[cacheKey] && videoCache[cacheKey].length >= count) {
    return videoCache[cacheKey].slice(0, count);
  }
  
  try {
    let newVideos: Video[] = [];
    
    // Attempt to get real videos for any category
    const fetchRealVideos = async () => {
      // For 'All' category, mix videos from multiple categories
      if (category === "All") {
        try {
          // Get popular videos
          const data = await fetchFromYouTubeAPI('videos', {
            part: 'snippet,statistics',
            chart: 'mostPopular',
            maxResults: (count * 2).toString(), // Request extra to ensure we have enough after filtering
            regionCode: 'US'
          });
          
          if (data.items && data.items.length > 0) {
            newVideos = data.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
            nextPageTokens[cacheKey] = data.nextPageToken || null;
            return true;
          }
          return false;
        } catch (error) {
          console.error("Error fetching 'All' videos:", error);
          return false;
        }
      } 
      else if (category === "Trending") {
        try {
          const data = await fetchFromYouTubeAPI('videos', {
            part: 'snippet,statistics',
            chart: 'mostPopular',
            maxResults: (count * 2).toString(),
            regionCode: 'US'
          });
          
          if (data.items && data.items.length > 0) {
            newVideos = data.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
            nextPageTokens[cacheKey] = data.nextPageToken || null;
            return true;
          }
          return false;
        } catch (error) {
          console.error("Error fetching Trending videos:", error);
          return false;
        }
      } 
      else {
        try {
          // For specific categories, use videoCategoryId
          const categoryId = YOUTUBE_CATEGORIES[category as keyof typeof YOUTUBE_CATEGORIES];
          if (categoryId) {
            const data = await fetchFromYouTubeAPI('videos', {
              part: 'snippet,statistics',
              chart: 'mostPopular',
              videoCategoryId: categoryId,
              maxResults: (count * 2).toString(),
              pageToken: nextPageTokens[cacheKey] || '',
              regionCode: 'US'
            });
            
            if (data.items && data.items.length > 0) {
              newVideos = data.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
              nextPageTokens[cacheKey] = data.nextPageToken || null;
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error(`Error fetching ${category} videos:`, error);
          return false;
        }
      }
    };
    
    // Make first attempt to get real videos
    let gotRealVideos = await fetchRealVideos();
    
    // If we couldn't get category-specific videos, try trending as backup
    if (!gotRealVideos) {
      try {
        console.warn(`Couldn't get videos for ${category}, trying trending videos instead`);
        const trendingData = await fetchFromYouTubeAPI('videos', {
          part: 'snippet,statistics',
          chart: 'mostPopular',
          maxResults: (count * 2).toString(),
          regionCode: 'US'
        });
        
        if (trendingData.items && trendingData.items.length > 0) {
          newVideos = trendingData.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
          gotRealVideos = true;
        }
      } catch (error) {
        console.error("Error fetching backup trending videos:", error);
      }
    }
    
    // If we still don't have videos, try a direct search for popular videos
    if (!gotRealVideos) {
      try {
        console.warn("Trying search API as last resort");
        const searchQuery = category === "All" || category === "Trending" 
          ? "popular videos" 
          : `popular ${category} videos`;
          
        const searchData = await fetchFromYouTubeAPI('search', {
          part: 'snippet',
          q: searchQuery,
          maxResults: (count * 2).toString(),
          type: 'video',
          videoEmbeddable: 'true'
        });
        
        if (searchData.items && searchData.items.length > 0) {
          // We need to get full video details to get view counts
          const videoIds = searchData.items
            .map((item: YouTubeVideoItem) => {
              if (typeof item.id === 'object' && item.id?.videoId) {
                return item.id.videoId;
              }
              return null;
            })
            .filter(Boolean)
            .join(",");
            
          if (videoIds) {
            const videoData = await fetchFromYouTubeAPI('videos', {
              part: 'snippet,statistics',
              id: videoIds
            });
            
            if (videoData.items && videoData.items.length > 0) {
              newVideos = videoData.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
              gotRealVideos = true;
            }
          }
        }
      } catch (error) {
        console.error("Error with search API fallback:", error);
      }
    }
    
    // Filter out potential ads
    if (newVideos.length > 0) {
      newVideos = filterAdsAndPoorContent(newVideos);
    }
    
    // Only use hardcoded fallback as absolute last resort
    if (newVideos.length === 0) {
      console.error(`CRITICAL: Could not load any videos from YouTube API for ${category}. Using emergency fallbacks.`);
      // Use a more diverse set of hardcoded fallbacks
      newVideos = [
        {
          id: "dQw4w9WgXcQ", // Rick Astley - Never Gonna Give You Up
          title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
          channel: "Rick Astley",
          views: "1.2B views",
          timestamp: "14 years ago",
        },
        {
          id: "9bZkp7q19f0", // PSY - Gangnam Style
          title: "PSY - GANGNAM STYLE(강남스타일) M/V",
          channel: "officialpsy",
          views: "4.6B views",
          timestamp: "11 years ago",
        },
        {
          id: "JGwWNGJdvx8", // Ed Sheeran - Shape of You
          title: "Ed Sheeran - Shape of You (Official Music Video)",
          channel: "Ed Sheeran",
          views: "5.9B views",
          timestamp: "6 years ago",
        }
      ];
    }
    
    // Cache the results
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    // Add new videos to cache
    videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
    cacheTimestamps[cacheKey] = Date.now();
    
    // Log success if we got real videos
    if (gotRealVideos) {
      console.log(`Successfully loaded ${newVideos.length} real videos for category: ${category}`);
    }
    
    return videoCache[cacheKey].slice(0, count);
    
  } catch (error) {
    console.error("Critical error fetching videos:", error);
    // Return minimal fallback only as a last resort
    return [
      {
        id: "dQw4w9WgXcQ",
        title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        channel: "Rick Astley",
        views: "1.2B views",
        timestamp: "14 years ago",
      }
    ];
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
      const data = await fetchFromYouTubeAPI('videos', {
        part: 'snippet,statistics',
        chart: 'mostPopular',
        maxResults: (count * 1.5).toString(),
        pageToken: nextPageTokens[cacheKey] || '',
        regionCode: 'US',
      });
      
      newVideos = data.items.map(formatVideoItem);
      nextPageTokens[cacheKey] = data.nextPageToken || null;
      
    } else {
      const categoryId = YOUTUBE_CATEGORIES[category as keyof typeof YOUTUBE_CATEGORIES];
      if (categoryId) {
        const data = await fetchFromYouTubeAPI('videos', {
          part: 'snippet,statistics',
          chart: 'mostPopular',
          videoCategoryId: categoryId,
          maxResults: (count * 1.5).toString(),
          pageToken: nextPageTokens[cacheKey] || '',
          regionCode: 'US',
        });
        
        newVideos = data.items.map(formatVideoItem);
        nextPageTokens[cacheKey] = data.nextPageToken || null;
      }
    }
    
    // Filter out potential ads
    newVideos = filterAdsAndPoorContent(newVideos);
    
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    // Add new videos to cache
    videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
    cacheTimestamps[cacheKey] = Date.now();
    
    // Return only the newly added videos
    return videoCache[cacheKey].slice(currentCount);
    
  } catch (error) {
    console.error("Error loading more videos:", error);
    return [];
  }
};

// Enhanced search debounce management
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const searchDebounceDelay = 300; // milliseconds

// Enhanced search function
export const searchVideos = async (query: string, count: number = 15): Promise<Video[]> => {
  if (!query.trim()) return [];
  
  const cacheKey = `search_${query.toLowerCase()}`;
  
  // If we have cached results for this search and they're not expired, return them
  if (videoCache[cacheKey] && !isCacheExpired(cacheKey)) {
    return videoCache[cacheKey].slice(0, count);
  }
  
  try {
    // Make a real search API call
    const searchData = await fetchFromYouTubeAPI('search', {
      part: 'snippet',
      q: query,
      maxResults: count.toString(), // Set to same count as category loading
      type: 'video',
      videoEmbeddable: 'true', // Only videos that can be embedded
      safeSearch: 'moderate', // Filter out inappropriate content
      relevanceLanguage: 'en',
    });
    
    // Early exit if no results
    if (!searchData.items || searchData.items.length === 0) {
      videoCache[cacheKey] = [];
      cacheTimestamps[cacheKey] = Date.now();
      return [];
    }
    
    // Extract video IDs for detailed info
    const videoIds = searchData.items
      .map((item: YouTubeVideoItem) => {
        if (typeof item.id === 'object' && item.id?.videoId) {
          return item.id.videoId;
        }
        return null;
      })
      .filter(Boolean)
      .join(",");
    
    if (!videoIds) {
      videoCache[cacheKey] = [];
      cacheTimestamps[cacheKey] = Date.now();
      return [];
    }
    
    // Get detailed info for those videos including statistics
    const videosData = await fetchFromYouTubeAPI('videos', {
      part: 'snippet,statistics',
      id: videoIds,
    });
    
    let videos = videosData.items.map((item: YouTubeVideoItem) => formatVideoItem(item));
    
    // Filter out potential ads
    videos = filterAdsAndPoorContent(videos);
    
    // Sort by relevance and view count (combined ranking)
    videos.sort((a: Video, b: Video) => {
      const viewsA = parseInt(a.views.replace(/[^0-9]/g, '')) || 0;
      const viewsB = parseInt(b.views.replace(/[^0-9]/g, '')) || 0;
      return viewsB - viewsA;
    });
    
    // Cache the results
    videoCache[cacheKey] = videos;
    cacheTimestamps[cacheKey] = Date.now();
    
    return videos.slice(0, count);
    
  } catch (error) {
    console.error("Error searching videos:", error);
    return [];
  }
};

// Debounced search function to prevent excessive API calls
export const debouncedSearchVideos = (
  query: string,
  count: number = 15,
  callback: (videos: Video[]) => void
): void => {
  // Clear previous timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  // Set new timer
  searchDebounceTimer = setTimeout(async () => {
    const results = await searchVideos(query, count);
    callback(results);
  }, searchDebounceDelay);
}; 