import { NextResponse } from 'next/server';
import { getLatestCyberNews } from '@/lib/rssFetcher';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sourcesParam = searchParams.get('sources');
    const selectedSources = sourcesParam ? sourcesParam.split(',') : [];

    let customSources = [];
    const customSourcesParam = searchParams.get('customSources');
    if (customSourcesParam) {
      try {
        customSources = JSON.parse(customSourcesParam);
      } catch (e) {
        console.error("Failed to parse custom sources:", e);
      }
    }

    const { items, sourceStatuses } = await getLatestCyberNews(selectedSources, customSources);
    
    // Set caching headers for better performance (1 hour)
    return NextResponse.json({ items, sourceStatuses }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59'
      }
    });
  } catch (error: any) {
    console.error("News Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news feed" },
      { status: 500 }
    );
  }
}
