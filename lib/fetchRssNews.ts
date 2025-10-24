// lib/fetchRssNews.ts
import { rssFeeds } from './rssFeeds';

export async function fetchRssNews(category: keyof typeof rssFeeds) {
  const feedUrl = rssFeeds[category];

  try {
    const res = await fetch(feedUrl);
    const data = await res.json();
    return data.items || [];
  } catch (error: any) {
console.error(`❌ Failed to fetch RSS feed for ${String(category)}:`, error);
    return [];
  }
}
