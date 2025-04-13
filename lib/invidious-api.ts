// Invidious API integration for VidLook
// Implementation using multiple Invidious instances for fallback

import { INVIDIOUS_CONFIG } from './config';

// Define our own Video interface instead of importing from youtube-api
export interface Video {
  id: string;
  title: string;
  channel: string;
  views: string;
  timestamp: string;
}

// List of Invidious instances to use with fallback support
// Source: https://api.invidious.io/instances.json (filtered for stable instances)
const INVIDIOUS_INSTANCES = [
  'https://invidious.fdn.fr',  // Fast, reliable French instance
  'https://inv.riverside.rocks', // US-based reliable instance
  'https://invidious.lunar.icu', // Reliable new instance
  'https://invidious.nerdvpn.de', // German instance
  'https://invidious.protokolla.fi', // Finnish instance
  'https://invidious.private.coffee', // US-based instance
  'https://iv.ggtyler.dev',     // US-based instance
  'https://yt.drgnz.club'       // Singapore-based instance
];

// Cache mechanism to avoid repeated API calls
const videoCache: Record<string, Video[]> = {};
let nextPageTokens: Record<string, string | null> = {};

// Cache expiration time (from config)
const CACHE_EXPIRATION = INVIDIOUS_CONFIG.CACHE_DURATION;
const cacheTimestamps: Record<string, number> = {};

// YouTube Categories mapped to Invidious API paths
export const VIDEO_CATEGORIES = {
  All: 'trending',       // Invidious trending
  Trending: 'trending',  // Same as All
  Music: 'trending?type=music',
  Gaming: 'trending?type=gaming',
  News: 'trending?type=news',
  Movies: 'trending?type=movies',
  Sports: 'trending?type=sports', // May fallback to default trending
  Technology: 'trending',       // No specific tech category in Invidious
};

// Format a video from Invidious API to our Video interface
const formatInvidiousVideo = (item: any): Video => {
  return {
    id: item.videoId,
    title: item.title || "Untitled Video",
    channel: item.author || "Unknown Channel",
    views: formatViewCount(item.viewCount),
    timestamp: item.publishedText || "",
  };
};

// Format view count to a readable format
const formatViewCount = (viewCount: number): string => {
  if (isNaN(viewCount)) return "0 views";
  
  if (viewCount >= 1000000) {
    return `${(viewCount / 1000000).toFixed(1)}M views`;
  } else if (viewCount >= 1000) {
    return `${(viewCount / 1000).toFixed(1)}K views`;
  } else {
    return `${viewCount} views`;
  }
};

// Check if cache is expired
const isCacheExpired = (cacheKey: string): boolean => {
  if (!cacheTimestamps[cacheKey]) return true;
  return Date.now() - cacheTimestamps[cacheKey] > CACHE_EXPIRATION;
};

// Get a random working Invidious instance
let currentInstanceIndex = 0;
const getInstance = async (): Promise<string> => {
  // Try the current instance first
  const instance = INVIDIOUS_INSTANCES[currentInstanceIndex];
  
  try {
    // Simple health check
    const response = await fetch(`${instance}/api/v1/stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3s timeout
    });
    
    if (response.ok) {
      return instance;
    }
  } catch (error) {
    console.warn(`Invidious instance ${instance} is down, trying next...`);
  }
  
  // Try the next instance if fallback is enabled
  if (INVIDIOUS_CONFIG.ENABLE_FALLBACK) {
    currentInstanceIndex = (currentInstanceIndex + 1) % INVIDIOUS_INSTANCES.length;
    return INVIDIOUS_INSTANCES[currentInstanceIndex];
  }
  
  // Return the current instance even if it failed (will likely fail again, but respects the config)
  return instance;
};

// Enhanced fetch function with fallback to different instances
const fetchFromInvidiousAPI = async (endpoint: string, params: Record<string, string> = {}, retries = INVIDIOUS_CONFIG.MAX_RETRIES): Promise<any> => {
  // Construct query parameters
  const queryParams = new URLSearchParams(params);
  
  // Try fetching with fallback to different instances
  let lastError;
  let attemptsLeft = retries;
  
  while (attemptsLeft > 0) {
    try {
      const instance = await getInstance();
      const url = `${instance}/api/v1/${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      // Fetch with timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INVIDIOUS_CONFIG.REQUEST_TIMEOUT);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Invidious API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error;
      attemptsLeft--;
      
      // Try a different instance for the next attempt if fallback is enabled
      if (INVIDIOUS_CONFIG.ENABLE_FALLBACK) {
        currentInstanceIndex = (currentInstanceIndex + 1) % INVIDIOUS_INSTANCES.length;
      }
      console.warn(`Error with Invidious API, trying another instance. ${attemptsLeft} attempts left.`);
      
      // Wait a bit before trying again
      if (attemptsLeft > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If we got here, all retries failed
  throw lastError || new Error('Failed to fetch from Invidious API after multiple attempts');
};

// Preload common categories to improve perceived performance
export const preloadCommonCategories = async (): Promise<void> => {
  try {
    await fetchVideosByCategory("Trending", 5, true);
    console.log("Preloaded trending videos");
  } catch (error) {
    console.error("Error preloading trending videos:", error);
  }
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
    const categoryPath = VIDEO_CATEGORIES[category as keyof typeof VIDEO_CATEGORIES] || 'trending';
    
    // Fetch videos from Invidious API
    const data = await fetchFromInvidiousAPI(categoryPath, { region: 'US' });
    
    if (Array.isArray(data) && data.length > 0) {
      newVideos = data.map((item: any) => formatInvidiousVideo(item));
    } else {
      console.warn(`No videos found for category ${category}`);
    }
    
    // Add new videos to cache
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
    cacheTimestamps[cacheKey] = Date.now();
    
    return videoCache[cacheKey].slice(0, count);
  } catch (error) {
    console.error("Error fetching videos by category:", error);
    throw error;
  }
};

// Function to fetch more videos (pagination)
export const fetchMoreVideos = async (
  category: string,
  count: number = 10
): Promise<Video[]> => {
  const cacheKey = `category_${category}`;
  
  try {
    const startIndex = videoCache[cacheKey] ? videoCache[cacheKey].length : 0;
    
    // If we've already fetched all videos (no more pages)
    if (nextPageTokens[cacheKey] === null && startIndex > 0) {
      console.log(`No more videos to fetch for ${category}`);
      return [];
    }
    
    // Call the regular fetch function but with the page token
    const allVideos = await fetchVideosByCategory(category, startIndex + count);
    
    // Return only the new videos
    return allVideos.slice(startIndex);
  } catch (error) {
    console.error("Error fetching more videos:", error);
    return [];
  }
};

// Function to search videos
export const searchVideos = async (query: string, count: number = 15): Promise<Video[]> => {
  if (!query.trim()) {
    return [];
  }
  
  const cacheKey = `search_${query}`;
  
  // If cached and not expired, return cached results
  if (videoCache[cacheKey] && !isCacheExpired(cacheKey)) {
    return videoCache[cacheKey].slice(0, count);
  }
  
  try {
    const data = await fetchFromInvidiousAPI('search', {
      q: query,
      type: 'video',
      page: '1',
      sort_by: 'relevance'
    });
    
    let videos: Video[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      // Filter to only include video type results
      const videoResults = data.filter((item: any) => item.type === 'video');
      videos = videoResults.map((item: any) => formatInvidiousVideo(item));
    }
    
    // Cache the results
    videoCache[cacheKey] = videos;
    cacheTimestamps[cacheKey] = Date.now();
    
    return videos.slice(0, count);
  } catch (error) {
    console.error(`Error searching videos for '${query}':`, error);
    return [];
  }
};

// Function to fetch more search results
export const fetchMoreSearchResults = async (query: string, count: number = 10): Promise<Video[]> => {
  const cacheKey = `search_${query}`;
  
  // If we don't have a cache entry yet, fetch the initial results
  if (!videoCache[cacheKey]) {
    return searchVideos(query, count);
  }
  
  try {
    // For Invidious, we need to fetch the next page
    const nextPage = Math.ceil(videoCache[cacheKey].length / count) + 1;
    
    const data = await fetchFromInvidiousAPI('search', {
      q: query,
      type: 'video',
      page: nextPage.toString(),
      sort_by: 'relevance'
    });
    
    let newVideos: Video[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      const videoResults = data.filter((item: any) => item.type === 'video');
      newVideos = videoResults.map((item: any) => formatInvidiousVideo(item));
      
      // Add to cache
      videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
      
      return newVideos.slice(0, count);
    }
    
    // No more results
    return [];
  } catch (error) {
    console.error(`Error fetching more search results for '${query}':`, error);
    return [];
  }
};

// Debounced search function to prevent too many API calls
let searchTimeout: NodeJS.Timeout | null = null;
export const debouncedSearchVideos = (
  query: string,
  count: number = 15,
  callback: (videos: Video[]) => void
): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchVideos(query, count);
      callback(results);
    } catch (error) {
      console.error("Error in debounced search:", error);
      callback([]);
    }
  }, 300); // 300ms debounce
};

// Function to get video details by ID
export const getVideoDetails = async (videoId: string): Promise<any> => {
  // Try each instance directly until one works
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying to fetch video ${videoId} from ${instance}`);
      
      // Direct fetch to bypass our custom fetch function for debugging
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch from ${instance} with status: ${response.status}`);
        continue; // Try next instance
      }
      
      const data = await response.json();
      
      // Verify we have necessary data
      if (!data || (!data.formatStreams && !data.adaptiveFormats)) {
        console.warn(`No video formats found in response from ${instance}`);
        continue; // Try next instance
      }
      
      // Make sure we have video formats we can use
      const hasPlayableFormats = (
        (data.formatStreams && data.formatStreams.length > 0) || 
        (data.adaptiveFormats && data.adaptiveFormats.length > 0)
      );
      
      if (!hasPlayableFormats) {
        console.warn(`No playable formats found from ${instance}`);
        continue; // Try next instance
      }
      
      // Fix potential issues with the video URLs
      if (data.formatStreams) {
        data.formatStreams = data.formatStreams.map((format: any) => {
          // Ensure URL is valid and has proper protocol
          if (format.url && !format.url.startsWith('http')) {
            format.url = `https:${format.url}`;
          }
          return format;
        });
      }
      
      if (data.adaptiveFormats) {
        data.adaptiveFormats = data.adaptiveFormats.map((format: any) => {
          // Ensure URL is valid and has proper protocol
          if (format.url && !format.url.startsWith('http')) {
            format.url = `https:${format.url}`;
          }
          return format;
        });
      }
      
      console.log(`Successfully loaded video data from ${instance}`);
      return data;
    } catch (error) {
      console.error(`Error fetching video details from ${instance} for ${videoId}:`, error);
      // Continue to the next instance
    }
  }
  
  // If all Invidious instances fail, try Piped as a last resort
  try {
    console.log('All Invidious instances failed, trying Piped API as fallback');
    
    // Piped instances are another YouTube frontend that might work when Invidious doesn't
    const pipedInstances = [
      'https://piped.video',
      'https://piped.privacydev.net',
      'https://piped.yt',
      'https://piped.mha.fi'
    ];
    
    for (const pipedInstance of pipedInstances) {
      try {
        const response = await fetch(`${pipedInstance}/api/v1/streams/${videoId}`, {
          method: 'GET',
          signal: AbortSignal.timeout(8000),
        });
        
        if (!response.ok) continue;
        
        const pipedData = await response.json();
        
        // Convert Piped format to Invidious format
        const invidiousFormatted = {
          title: pipedData.title,
          videoId: videoId,
          lengthSeconds: pipedData.duration,
          formatStreams: pipedData.videoStreams
            .filter((stream: any) => stream.format.includes('video/mp4'))
            .map((stream: any) => ({
              url: stream.url,
              resolution: stream.quality,
              container: 'mp4',
              encoding: 'h264'
            })),
          adaptiveFormats: [],
          description: pipedData.description || '',
          author: pipedData.uploader || 'Unknown',
          authorId: pipedData.uploaderUrl?.split('/').pop() || '',
          viewCount: pipedData.views,
          hlsUrl: pipedData.hls || null,
          directUrl: pipedData.videoStreams?.[0]?.url || null
        };
        
        console.log(`Successfully loaded video data from Piped ${pipedInstance}`);
        return invidiousFormatted;
      } catch (error) {
        console.error(`Error with Piped instance ${pipedInstance}:`, error);
      }
    }
  } catch (error) {
    console.error('Error with Piped fallback:', error);
  }
  
  // If we get here, all instances failed
  throw new Error(`Failed to fetch video details for ${videoId} from any Invidious or Piped instance`);
}; 