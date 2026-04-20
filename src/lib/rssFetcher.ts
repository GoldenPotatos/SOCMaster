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
    url: 'https://t.me/s/CyberSecurityIL'
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
    url: 'https://www.gov.il/en/departments/israel_national_cyber_directorate/RSS'
  },
  {
    id: 'reddit_netsec',
    name: 'Reddit /r/netsec',
    url: 'https://www.reddit.com/r/netsec/hot.json?limit=10'
  },
  {
    id: 'reddit_cybersec',
    name: 'Reddit /r/cybersecurity',
    url: 'https://www.reddit.com/r/cybersecurity/hot.json?limit=10'
  }
];

// No proxy used anymore since we bypass naturally.

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

async function fetchTelegramSource(source: NewsSource): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
  });
  if (!res.ok) throw Object.assign(new Error(`Telegram fetch failed: ${res.status}`), { status: res.status });
  
  const text = await res.text();
  // We extract the public channel messages from the HTML using regex
  const regex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g;
  const messages = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Strip HTML tags for clean summary
    const cleanText = match[1].replace(/<br\/?>/g, '\n').replace(/<[^>]+>/g, '').trim();
    messages.push(cleanText);
  }
  
  // Return the last 5 messages, reversed so newest is first
  return messages.slice(-5).reverse().map((msg, i) => ({
    id: `tg_${Date.now()}_${i}`,
    title: msg.length > 50 ? msg.substring(0, 50) + '...' : msg,
    summary: msg,
    sourceName: source.name,
    link: source.url,
    isoDate: new Date(Date.now() - i * 60000).toISOString() // Fake recent dates to sort them on top
  }));
}

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
    .filter((p: any) => !p.stickied)
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
          fetchUrl = `https://www.reddit.com/r/${sub}/hot.json?limit=10`;
        } else if (fetchUrl.includes('reddit.com/r/') && !fetchUrl.includes('.json')) {
          fetchUrl = fetchUrl.split('?')[0].replace(/\/$/, '') + '.json?limit=10';
          if (fetchUrl.includes('/top.json')) {
             fetchUrl = fetchUrl.replace('/top.json', '/hot.json');
          }
        }

        const items = await fetchRedditSource({ ...source, url: fetchUrl });
        sourceStatuses[source.id] = 200;
        return items;
      }

      // Check if it's a Telegram source
      if (source.id === 'erez_dasa' || source.url.includes('t.me/s/')) {
        const items = await fetchTelegramSource(source);
        sourceStatuses[source.id] = 200;
        return items;
      }

      // Standard RSS fetch
      let feed;
      try {
        feed = await parser.parseURL(source.url);
      } catch (e) {
        throw e;
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

