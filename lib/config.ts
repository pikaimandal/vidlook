// VidLook App Configuration

// Invidious API configuration
export const INVIDIOUS_CONFIG = {
  // Default preferred video quality (low, medium, high, best)
  DEFAULT_QUALITY: 'medium',
  
  // Maximum number of retries for API requests
  MAX_RETRIES: 3,
  
  // Timeout for API requests in milliseconds
  REQUEST_TIMEOUT: 5000,
  
  // Cache duration in milliseconds (15 minutes)
  CACHE_DURATION: 15 * 60 * 1000,
  
  // Default region for trending videos
  DEFAULT_REGION: 'US',
  
  // Enable or disable auto-switching to another instance when one fails
  ENABLE_FALLBACK: true
};

// Token earning configuration
export const TOKEN_CONFIG = {
  // Tokens earned per minute of video watched
  TOKENS_PER_MINUTE: 1,
  
  // Minimum video watch duration in seconds to earn tokens
  MIN_WATCH_DURATION: 30,
  
  // Check interval for token accrual in milliseconds
  TOKEN_CHECK_INTERVAL: 5000
};

// App settings
export const APP_CONFIG = {
  // Name of the app
  APP_NAME: 'VidLook',
  
  // Version
  VERSION: '1.0.0',
  
  // Description
  DESCRIPTION: 'Watch videos and earn VIDEO tokens',
  
  // Social media links
  SOCIAL: {
    TWITTER: 'https://twitter.com/vidlookapp',
    TELEGRAM: 'https://t.me/vidlookapp'
  }
}; 