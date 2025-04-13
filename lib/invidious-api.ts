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

// We'll keep a smaller set of hardcoded videos as backup in case the API fails
export const FALLBACK_VIDEOS: Record<string, Video[]> = {
  Trending: [
    {
      id: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
      channel: "Rick Astley",
      views: "1.2B views",
      timestamp: "14 years ago",
    },
    {
      id: "9bZkp7q19f0",
      title: "PSY - GANGNAM STYLE(강남스타일) M/V",
      channel: "officialpsy",
      views: "4.6B views",
      timestamp: "11 years ago",
    },
    {
      id: "JGwWNGJdvx8", 
      title: "Ed Sheeran - Shape of You (Official Music Video)",
      channel: "Ed Sheeran",
      views: "5.9B views",
      timestamp: "6 years ago",
    }
  ],
  Gaming: [
    {
      id: "8X2kIfS6fb8",
      title: "GTA 6 Trailer 1",
      channel: "Rockstar Games",
      views: "175M views",
      timestamp: "4 months ago",
    },
    {
      id: "AZYmIes2Xpw",
      title: "Minecraft Live 2023: All Announcements",
      channel: "Minecraft",
      views: "12M views",
      timestamp: "6 months ago",
    }
  ],
  Music: [
    {
      id: "kJQP7kiw5Fk",
      title: "Luis Fonsi - Despacito ft. Daddy Yankee",
      channel: "Luis Fonsi",
      views: "8.1B views",
      timestamp: "7 years ago",
    },
    {
      id: "RgKAFK5djSk",
      title: "Wiz Khalifa - See You Again ft. Charlie Puth [Official Video]",
      channel: "Wiz Khalifa",
      views: "5.8B views",
      timestamp: "8 years ago",
    }
  ],
  All: [
    {
      id: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
      channel: "Rick Astley",
      views: "1.2B views",
      timestamp: "14 years ago",
    }
  ]
};

// List of Invidious instances to use with fallback support - updated with most reliable ones
// Source: https://api.invidious.io/ (filtered for best uptime)
const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',            // Very reliable German instance (99.97% uptime)
  'https://inv.nadeko.net',      // Reliable Chilean instance (98.69% uptime)
  'https://invidious.nerdvpn.de', // German instance (99.96% uptime)
  'https://vid.puffyan.us',      // US-based instance
  'https://invidious.fdn.fr',    // Fast French instance
  'https://inv.riverside.rocks', // US-based instance
  'https://invidious.slipfox.xyz', // US-based instance
  'https://invidious.snopyta.org', // Finland-based instance
  'https://inv.vern.cc',         // US-based instance
  'https://y.com.sb'             // Netherlands-based instance
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

// Get a random working Invidious instance with improved error handling
let currentInstanceIndex = 0;
const getInstance = async (): Promise<string> => {
  // Try multiple instances in sequence
  let startIndex = currentInstanceIndex;
  let instancesChecked = 0;
  
  while (instancesChecked < INVIDIOUS_INSTANCES.length) {
    const instance = INVIDIOUS_INSTANCES[currentInstanceIndex];
    
    try {
      // Simple health check - use a shorter timeout for faster response
      const response = await fetch(`${instance}/api/v1/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2s timeout for faster recovery
      });
      
      if (response.ok) {
        return instance;
      }
    } catch (error) {
      console.warn(`Invidious instance ${instance} is down, trying next...`);
    }
    
    // Move to the next instance
    currentInstanceIndex = (currentInstanceIndex + 1) % INVIDIOUS_INSTANCES.length;
    instancesChecked++;
  }
  
  // If all instances failed, return the first one (user will see an error)
  console.error("All Invidious instances are down, using first instance as fallback");
  return INVIDIOUS_INSTANCES[0];
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
      
      // Fetch with timeout to avoid hanging requests - reduced timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout instead of 8s
      
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
        await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay
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
  
  // Try each instance directly for faster response
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying to fetch ${category} videos from ${instance}`);
      let categoryPath = '';
      let params: Record<string, string> = { region: 'US' };
      
      // Determine the appropriate API endpoint based on category
      if (category === 'Trending' || category === 'All') {
        categoryPath = 'trending';
      } else if (category === 'Music') {
        categoryPath = 'trending';
        params.type = 'music';
      } else if (category === 'Gaming') {
        categoryPath = 'trending';
        params.type = 'gaming';
      } else if (category === 'News') {
        categoryPath = 'trending';
        params.type = 'news';
      } else if (category === 'Movies') {
        categoryPath = 'trending';
        params.type = 'movies';
      } else {
        // Default to trending
        categoryPath = 'trending';
      }

      // Build the query string
      const queryParams = new URLSearchParams(params);
      const url = `${instance}/api/v1/${categoryPath}?${queryParams.toString()}`;
      
      // Fetch with a timeout - reduced from 8s to 5s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); 
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Error response from ${instance}: ${response.status}`);
        continue; // Try next instance
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`No videos found from ${instance} for ${category}`);
        continue; // Try next instance
      }
      
      // Format the response into our Video format
      const newVideos = data.map((item: any) => formatInvidiousVideo(item));
      
      // Add new videos to cache
      if (!videoCache[cacheKey]) {
        videoCache[cacheKey] = [];
      }
      
      videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
      cacheTimestamps[cacheKey] = Date.now();
      
      console.log(`Successfully loaded ${newVideos.length} videos for ${category} from ${instance}`);
      return videoCache[cacheKey].slice(0, count);
    } catch (error) {
      console.error(`Error fetching videos from ${instance} for ${category}:`, error);
      // Continue to the next instance
    }
  }
  
  // If all instances failed, try to use Piped API as fallback
  try {
    console.log(`All Invidious instances failed for ${category}, trying Piped as fallback`);
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.projectsegfau.lt',
      'https://api.piped.privacydev.net'
    ];
    
    for (const pipedInstance of pipedInstances) {
      try {
        // Piped uses different endpoints for trending/etc
        let pipedEndpoint = 'trending';
        
        if (category === 'Music') pipedEndpoint = 'trending?region=music';
        else if (category === 'Gaming') pipedEndpoint = 'trending?region=gaming';
        else if (category === 'News') pipedEndpoint = 'trending?region=news';
        else if (category === 'Movies') pipedEndpoint = 'trending?region=movies';
        
        const response = await fetch(`${pipedInstance}/${pipedEndpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // Reduced timeout
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) continue;
        
        // Convert Piped format to our Video format
        const newVideos = data.map((item: any) => ({
          id: item.url.split('watch?v=')[1] || item.url.split('/').pop(),
          title: item.title || "Untitled Video",
          channel: item.uploaderName || "Unknown Channel",
          views: formatViewCount(item.views || 0),
          timestamp: item.uploadedDate || "",
        }));
        
        // Add to cache
        if (!videoCache[cacheKey]) {
          videoCache[cacheKey] = [];
        }
        
        videoCache[cacheKey] = [...videoCache[cacheKey], ...newVideos];
        cacheTimestamps[cacheKey] = Date.now();
        
        console.log(`Successfully loaded ${newVideos.length} videos from Piped ${pipedInstance}`);
        return videoCache[cacheKey].slice(0, count);
      } catch (error) {
        console.error(`Error with Piped instance ${pipedInstance}:`, error);
      }
    }
  } catch (error) {
    console.error('Error with Piped fallback:', error);
  }
  
  // If we still have no videos, check if we have any fallback videos
  if (FALLBACK_VIDEOS[category as keyof typeof FALLBACK_VIDEOS]) {
    console.log(`Using fallback videos for ${category}`);
    const fallbackVideos = FALLBACK_VIDEOS[category as keyof typeof FALLBACK_VIDEOS];
    
    // Add fallback videos to cache
    if (!videoCache[cacheKey]) {
      videoCache[cacheKey] = [];
    }
    
    videoCache[cacheKey] = [...videoCache[cacheKey], ...fallbackVideos];
    
    return videoCache[cacheKey].slice(0, count);
  }
  
  // If we reach here, all attempts failed
  console.error(`Failed to fetch videos for ${category} from any source`);
  throw new Error(`Failed to fetch videos for ${category}`);
};

// Function to fetch more videos (pagination)
export const fetchMoreVideos = async (
  category: string,
  count: number = 10
): Promise<Video[]> => {
  const cacheKey = `category_${category}`;
  
  try {
    const startIndex = videoCache[cacheKey] ? videoCache[cacheKey].length : 0;
    
    // Try direct fetch from each instance with page parameter
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        console.log(`Fetching more videos for ${category} from ${instance}`);
        
        // Determine the endpoint based on category
        let categoryPath = '';
        let params: Record<string, string> = { region: 'US' };
        
        if (category === 'Trending' || category === 'All') {
          categoryPath = 'trending';
        } else if (category === 'Music') {
          categoryPath = 'trending';
          params.type = 'music';
        } else if (category === 'Gaming') {
          categoryPath = 'trending';
          params.type = 'gaming';
        } else if (category === 'News') {
          categoryPath = 'trending';
          params.type = 'news';
        } else if (category === 'Movies') {
          categoryPath = 'trending';
          params.type = 'movies';
        } else {
          categoryPath = 'trending';
        }
        
        // Add popular videos for more content
        const popularEndpoint = 'popular';
        const popularParams = new URLSearchParams();
        
        // Fetch with a timeout - reduced
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${instance}/api/v1/${popularEndpoint}?${popularParams.toString()}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`Error loading more videos from ${instance}: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          console.warn(`No more videos found from ${instance}`);
          continue;
        }
        
        // Format response into our Video format
        const newVideos = data.map((item: any) => formatInvidiousVideo(item));
        
        // Add to cache, ensuring we don't add duplicates
        const existingIds = videoCache[cacheKey] ? videoCache[cacheKey].map(v => v.id) : [];
        const uniqueNewVideos = newVideos.filter(v => !existingIds.includes(v.id));
        
        if (!videoCache[cacheKey]) {
          videoCache[cacheKey] = [];
        }
        
        if (uniqueNewVideos.length > 0) {
          videoCache[cacheKey] = [...videoCache[cacheKey], ...uniqueNewVideos];
          console.log(`Added ${uniqueNewVideos.length} more videos from ${instance}`);
          return uniqueNewVideos.slice(0, count);
        }
      } catch (error) {
        console.error(`Error fetching more videos from ${instance}:`, error);
      }
    }
    
    // If we get here, we couldn't load more videos from any instance
    console.warn('Could not load more videos from any Invidious instance');
    
    // Try to append some fallback videos if we haven't already used them all
    if (FALLBACK_VIDEOS[category as keyof typeof FALLBACK_VIDEOS]) {
      const fallbackVideos = FALLBACK_VIDEOS[category as keyof typeof FALLBACK_VIDEOS];
      const existingIds = videoCache[cacheKey] ? videoCache[cacheKey].map(v => v.id) : [];
      const unusedFallbacks = fallbackVideos.filter(v => !existingIds.includes(v.id));
      
      if (unusedFallbacks.length > 0) {
        if (!videoCache[cacheKey]) {
          videoCache[cacheKey] = [];
        }
        
        videoCache[cacheKey] = [...videoCache[cacheKey], ...unusedFallbacks];
        console.log(`Added ${unusedFallbacks.length} fallback videos`);
        return unusedFallbacks.slice(0, count);
      }
    }
    
    // If we still have no more videos, return empty array
    return [];
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

// Function to get video details by ID with improved error handling
export const getVideoDetails = async (videoId: string): Promise<any> => {
  // Try each instance directly until one works
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying to fetch video ${videoId} from ${instance}`);
      
      // Direct fetch to bypass our custom fetch function for debugging
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // Reduced timeout
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
      'https://piped-api.privacy.com.de',
      'https://api.piped.projectsegfau.lt',
      'https://piped-api.garudalinux.org',
      'https://pipedapi.kavin.rocks'
    ];
    
    for (const pipedInstance of pipedInstances) {
      try {
        const response = await fetch(`${pipedInstance}/streams/${videoId}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) continue;
        
        const pipedData = await response.json();
        
        // Convert Piped format to Invidious format
        const invidiousFormatted = {
          title: pipedData.title,
          videoId: videoId,
          lengthSeconds: pipedData.duration,
          formatStreams: pipedData.videoStreams
            .filter((stream: any) => stream.format?.includes('video/mp4'))
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