// Video interface for the application
export interface Video {
  id: string;
  title: string;
  channel: string;
  views: string;
  timestamp: string;
}

// Response structure from YouTube API
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
  snippet: {
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