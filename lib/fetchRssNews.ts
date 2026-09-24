// lib/fetchRssNews.ts
import { rssFeeds } from './rssFeeds';
import { withPublicReadDeadline } from './publicReadDeadline';

export async function fetchRssNews(category: keyof typeof rssFeeds, options: { signal?: AbortSignal; throwOnError?: boolean } = {}) {
  const feedUrl = rssFeeds[category];

  try {
    return await withPublicReadDeadline(4000, async (signal) => {
      const res = await fetch(feedUrl, { signal });
      if (!res.ok) throw new Error('RSS feed unavailable');
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    }, options.signal);
  } catch (error: any) {
    if (options.throwOnError) throw error;
console.error(`❌ Failed to fetch RSS feed for ${String(category)}:`, error);
    return [];
  }
}
