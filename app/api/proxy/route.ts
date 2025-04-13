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
];

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

    // Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Fetch the URL with timeout
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VidLook/1.0)'
        }
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // Read the response body
      const responseBody = await response.json();

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
      
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
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

    // Get the body from the request
    const body = await request.json();

    // Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Fetch the URL with timeout
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VidLook/1.0)'
        },
        body: JSON.stringify(body)
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // Read the response body
      const responseBody = await response.json();

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
      
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
} 