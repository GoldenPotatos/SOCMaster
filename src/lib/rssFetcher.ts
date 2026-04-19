import Parser from 'rss-parser';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  link: string;
  isoDate?: string;
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
}

export const AVAILABLE_SOURCES: NewsSource[] = [
  {
    id: 'erez_dasa',
    name: 'CyberSecurityIL (Erez Dasa)',
    url: 'https://rsshub.app/telegram/channel/CyberSecurityIL'
  },
  {
    id: 'bleeping',
    name: 'BleepingComputer',
    url: 'https://www.bleepingcomputer.com/feed/'
  },
  {
    id: 'hackernews',
    name: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews'
  },
  {
    id: 'darkreading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml'
  },
  {
    id: 'hammond',
    name: 'John Hammond (YouTube)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVeW9qkBjo3zosnqUbG7CFw'
  },
  {
    id: 'incd',
    name: 'Israel National Cyber Directorate (INCD)',
    url: 'https://www.gov.il/he/departments/news/cyber_directorate/RSS'
  },
  {
    id: 'reddit_netsec',
    name: 'Reddit /r/netsec',
    url: 'https://www.reddit.com/r/netsec/top.json?t=day&limit=10'
  },
  {
    id: 'reddit_cybersec',
    name: 'Reddit /r/cybersecurity',
    url: 'https://www.reddit.com/r/cybersecurity/top.json?t=day&limit=10'
  }
];

// Sources that are blocked by CORS, government firewalls, or Cloudflare and must
// be fetched server-side via our /api/proxy-rss route with spoofed browser headers.
const PROXIED_SOURCE_IDS = new Set(['incd', 'erez_dasa']);

// Base URL for internal API calls (server-side requires absolute URL)
const INTERNAL_API_BASE =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * Returns the URL to use when fetching an RSS feed.
 * Blocked sources are routed through our server-side proxy.
 */
function resolveRssUrl(source: NewsSource, forceProxy = false): string {
  if (forceProxy || PROXIED_SOURCE_IDS.has(source.id)) {
    return `${INTERNAL_API_BASE}/api/proxy-rss?url=${encodeURIComponent(source.url)}`;
  }
  return source.url;
}

// rss-parser instance with spoofed browser headers for direct fetches
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
  }
});

const REDDIT_SOURCE_IDS = ['reddit_netsec', 'reddit_cybersec'];

async function fetchRedditSource(source: NewsSource): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': 'web:SOCMaster:v1.0.0 (by /u/socmaster_admin)'
    }
  });
  if (!res.ok) throw Object.assign(new Error(`Reddit fetch failed: ${res.status}`), { status: res.status });
  const json = await res.json();
  const posts: any[] = json?.data?.children?.map((c: any) => c.data) || [];
  return posts
    .filter((p: any) => (p.ups ?? 0) >= 100 && !p.stickied)
    .slice(0, 10)
    .map((p: any) => ({
      id: p.id || Math.random().toString(36).substr(2, 9),
      title: p.title || 'Untitled',
      summary: p.selftext ? p.selftext.slice(0, 200) : `${p.score} upvotes · ${p.num_comments} comments`,
      sourceName: source.name,
      link: p.url && p.url.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`,
      isoDate: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : undefined
    }));
}

export async function getLatestCyberNews(selectedSourceIds: string[], customSources: NewsSource[] = []): Promise<{ items: NewsItem[], sourceStatuses: Record<string, number> }> {
  // Merge available sources with custom sources
  const allAvailable = [...AVAILABLE_SOURCES, ...customSources];
  const sourcesToFetch = allAvailable.filter(s => selectedSourceIds.includes(s.id));
  
  if (sourcesToFetch.length === 0) return { items: [], sourceStatuses: {} };

  const sourceStatuses: Record<string, number> = {};

  const feedPromises = sourcesToFetch.map(async (source) => {
    try {
      // Reddit sources use their own JSON API
      const isReddit = REDDIT_SOURCE_IDS.includes(source.id) || 
                       source.url.includes('reddit.com') || 
                       source.url.startsWith('reddit:');
      
      if (isReddit) {
        let fetchUrl = source.url;
        if (fetchUrl.startsWith('reddit:')) {
          const sub = fetchUrl.replace('reddit:', '');
          fetchUrl = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=10`;
        } else if (fetchUrl.includes('reddit.com/r/') && !fetchUrl.includes('.json')) {
          fetchUrl = fetchUrl.split('?')[0].replace(/\/$/, '') + '.json?t=day&limit=10';
        }

        const items = await fetchRedditSource({ ...source, url: fetchUrl });
        sourceStatuses[source.id] = 200;
        return items;
      }

      // For all other RSS sources, resolve through proxy if needed
      const fetchUrl = resolveRssUrl(source);
      let feed;
      try {
        feed = await parser.parseURL(fetchUrl);
      } catch (e) {
        // Fallback: if the erez_dasa primary URL fails, try the alternate rsshub path via proxy
        if (source.id === 'erez_dasa') {
          console.warn(`Primary feed for ${source.name} failed, trying fallback...`);
          const fallbackUrl = resolveRssUrl({ ...source, url: 'https://rsshub.app/telegram/channel/CyberSecurityIL?filterout=JOIN' }, true);
          feed = await parser.parseURL(fallbackUrl);
        } else {
          throw e;
        }
      }
      
      if (!feed || !feed.items) return [];

      sourceStatuses[source.id] = 200;
      return feed.items.slice(0, 5).map((item) => ({
        id: item.guid || item.link || Math.random().toString(36).substr(2, 9),
        title: item.title || 'Untitled',
        summary: item.contentSnippet || item.content || '',
        sourceName: source.name,
        link: item.link || '',
        isoDate: item.isoDate
      }));
    } catch (error: any) {
      console.error(`Error fetching RSS from ${source.name} (${source.url}):`, error);
      sourceStatuses[source.id] = error.status || (error.message?.includes('403') ? 403 : 500);
      return [];
    }
  });

  const results = await Promise.all(feedPromises);
  const flattenedResults = results.flat();

  const sortedItems = flattenedResults.sort((a, b) => {
    if (a.isoDate && b.isoDate) {
      return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
    }
    return 0;
  });

  return { items: sortedItems, sourceStatuses };
}

