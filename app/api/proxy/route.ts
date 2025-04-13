import { NextRequest, NextResponse } from 'next/server';

// List of allowed domains for proxy (Invidious and Piped instances)
const ALLOWED_DOMAINS = [
  'yewtu.be',
  'inv.nadeko.net',
  'invidious.nerdvpn.de',
  'vid.puffyan.us',
  'invidious.fdn.fr',
  'inv.riverside.rocks',
  'invidious.slipfox.xyz',
  'invidious.snopyta.org',
  'inv.vern.cc',
  'y.com.sb',
  'pipedapi.kavin.rocks',
  'api.piped.projectsegfau.lt',
  'piped-api.garudalinux.org',
  'api.piped.privacydev.net',
  'invidious.private.coffee',
  'invidious.lunar.icu',
  'yt.artemislena.eu',
  'invidious.protokolla.fi',
  'inv.tux.pizza',
  'invidious.drgns.space',
];

// Sample fallback response for stream requests when all external APIs fail
const FALLBACK_VIDEOS = {
  formatStreams: [
    {
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      resolution: "720p",
      container: "mp4",
      encoding: "h264"
    }
  ],
  title: "Fallback Video (API Error)",
  videoId: "fallback",
  lengthSeconds: 596,
  author: "Sample",
  viewCount: 1000,
  description: "This is a fallback video shown when API connections fail"
};

/**
 * API proxy route to bypass CORS restrictions when accessing Invidious/Piped APIs
 * 
 * Query parameters:
 * - url: The full URL to proxy (required)
 * - timeout: Timeout in milliseconds (optional, default: 5000)
 */
export async function GET(request: NextRequest) {
  try {
    // Get the URL from the query parameters
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const timeout = parseInt(searchParams.get('timeout') || '5000', 10);
    const allowFallback = searchParams.get('allowFallback') !== 'false';

    // If no URL provided, return an error
    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Validate the URL is from an allowed domain for security
    const urlObj = new URL(url);
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return NextResponse.json(
        { error: 'Invalid domain. Only Invidious/Piped instances are allowed' },
        { status: 403 }
      );
    }

    // Check if this is a video streams request (these frequently fail)
    const isStreamsRequest = url.includes('/videos/') || url.includes('/streams/');

    // Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`Proxy attempt: ${url}`);
      
      // Fetch the URL with timeout
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // If the request was unsuccessful
      if (!response.ok) {
        console.error(`Proxy error: ${url} returned ${response.status}`);
        
        // If this is a streams request and fallback is allowed, return fallback video
        if (isStreamsRequest && allowFallback) {
          console.log('Returning fallback video data');
          return NextResponse.json(FALLBACK_VIDEOS, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Otherwise return the error
        const errorText = await response.text();
        return NextResponse.json(
          { error: `API returned ${response.status}: ${errorText}` },
          { status: response.status }
        );
      }

      // Read the response body
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (parseError) {
        console.error(`JSON parse error for ${url}:`, parseError);
        return NextResponse.json(
          { error: 'Failed to parse JSON response' },
          { status: 500 }
        );
      }

      // Forward the response
      return NextResponse.json(responseBody, {
        status: response.status,
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      console.error(`Fetch error for ${url}:`, fetchError?.message || 'Unknown error');
      
      if (fetchError?.name === 'AbortError') {
        console.log(`Request timeout for ${url}`);
        
        // If this is a streams request and fallback is allowed, return fallback video
        if (isStreamsRequest && allowFallback) {
          console.log('Returning fallback video data after timeout');
          return NextResponse.json(FALLBACK_VIDEOS, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      // If this is a streams request and fallback is allowed, return fallback video
      if (isStreamsRequest && allowFallback) {
        console.log('Returning fallback video data after fetch error');
        return NextResponse.json(FALLBACK_VIDEOS, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return NextResponse.json(
        { error: `Fetch error: ${fetchError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Proxy error:', error?.message || error);
    return NextResponse.json(
      { error: `Failed to proxy request: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Also handle POST requests for more complex API calls
export async function POST(request: NextRequest) {
  try {
    // Get the URL from the query parameters
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const timeout = parseInt(searchParams.get('timeout') || '5000', 10);
    const allowFallback = searchParams.get('allowFallback') !== 'false';

    // If no URL provided, return an error
    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Validate the URL is from an allowed domain for security
    const urlObj = new URL(url);
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return NextResponse.json(
        { error: 'Invalid domain. Only Invidious/Piped instances are allowed' },
        { status: 403 }
      );
    }

    // Check if this is a video streams request (these frequently fail)
    const isStreamsRequest = url.includes('/videos/') || url.includes('/streams/');

    // Get the body from the request
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`Proxy POST attempt: ${url}`);
      
      // Fetch the URL with timeout
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(body)
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // If the request was unsuccessful
      if (!response.ok) {
        console.error(`Proxy POST error: ${url} returned ${response.status}`);
        
        // If this is a streams request and fallback is allowed, return fallback video
        if (isStreamsRequest && allowFallback) {
          console.log('Returning fallback video data for POST request');
          return NextResponse.json(FALLBACK_VIDEOS, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Otherwise return the error
        const errorText = await response.text();
        return NextResponse.json(
          { error: `API returned ${response.status}: ${errorText}` },
          { status: response.status }
        );
      }

      // Read the response body
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (parseError) {
        console.error(`JSON parse error for POST ${url}:`, parseError);
        return NextResponse.json(
          { error: 'Failed to parse JSON response' },
          { status: 500 }
        );
      }

      // Forward the response
      return NextResponse.json(responseBody, {
        status: response.status,
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      console.error(`POST fetch error for ${url}:`, fetchError?.message || 'Unknown error');
      
      if (fetchError?.name === 'AbortError') {
        console.log(`POST request timeout for ${url}`);
        
        // If this is a streams request and fallback is allowed, return fallback video
        if (isStreamsRequest && allowFallback) {
          console.log('Returning fallback video data after POST timeout');
          return NextResponse.json(FALLBACK_VIDEOS, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      // If this is a streams request and fallback is allowed, return fallback video
      if (isStreamsRequest && allowFallback) {
        console.log('Returning fallback video data after POST fetch error');
        return NextResponse.json(FALLBACK_VIDEOS, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return NextResponse.json(
        { error: `Fetch error: ${fetchError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Proxy POST error:', error?.message || error);
    return NextResponse.json(
      { error: `Failed to proxy POST request: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 