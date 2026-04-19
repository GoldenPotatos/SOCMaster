import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return new NextResponse("URL is required", { status: 400 });
    }

    // Spoof a full browser request to bypass CORS, government firewalls, and
    // Cloudflare bot-detection that blocks generic or missing User-Agent headers.
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      // next.js fetch cache: don't cache this proxy, always get fresh data
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch the RSS feed: ${response.status}`, { status: response.status });
    }

    const data = await response.text();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });

  } catch (error: any) {
    console.error("Proxy RSS Error:", error);
    return new NextResponse("Failed to proxy RSS feed", { status: 500 });
  }
}

