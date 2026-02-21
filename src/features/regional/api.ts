import type { NewsItem } from "./types";
import { FALLBACK_NEWS } from "./fallback";
import { fetchPublicNews, type Article } from '../../../lib/publicNewsApi';
import { buildNewsUrl } from '../../../lib/newsRoutes';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value || '');
}

function coerceCategory(raw: unknown): NewsItem['category'] {
  const v = asString(raw).toLowerCase();
  if (v.includes('crime')) return 'Crime';
  if (v.includes('health')) return 'Health';
  if (v.includes('environment') || v.includes('climate')) return 'Environment';
  if (v.includes('culture')) return 'Culture';
  if (v.includes('education') || v.includes('campus') || v.includes('student')) return 'Education';
  if (v.includes('development') || v.includes('infra') || v.includes('project')) return 'Development';
  return 'Civic';
}

function articleToNewsItem(raw: Article, language?: string): NewsItem | null {
  const title = asString((raw as any)?.title).trim();
  if (!title) return null;

  const id = asString((raw as any)?._id || (raw as any)?.id || '').trim();
  const slug = asString((raw as any)?.slug || id).trim();
  if (!id) return null;

  const source = asString((raw as any)?.source?.name || (raw as any)?.source || 'News Pulse').trim();
  const publishedAt = asString((raw as any)?.publishedAt || (raw as any)?.createdAt || '').trim() || undefined;
  const summary = asString((raw as any)?.summary || (raw as any)?.excerpt || '').trim() || undefined;
  const district =
    asString((raw as any)?.district || (raw as any)?.city || (raw as any)?.location || (raw as any)?.region || '').trim() ||
    undefined;
  const category = coerceCategory((raw as any)?.category);
  const url = buildNewsUrl({ id, slug, lang: language });

  return { id, title, source, url, category, district, summary, publishedAt };
}

export async function fetchRegionalNews(state: string, language?: string): Promise<NewsItem[]> {
  try {
    const resp = await fetchPublicNews({
      category: 'regional',
      language: language as any,
      limit: 30,
      extraQuery: { state },
    });
    const mapped = (resp.items || []).map((a) => articleToNewsItem(a, language)).filter(Boolean) as NewsItem[];
    return mapped.length ? mapped : FALLBACK_NEWS;
  } catch {
    return FALLBACK_NEWS;
  }
}

export async function fetchYouthVoices(state: string, language?: string): Promise<NewsItem[]> {
  try {
    const resp = await fetchPublicNews({
      category: 'youth-pulse',
      language: language as any,
      limit: 10,
      extraQuery: { state },
    });
    const mapped = (resp.items || [])
      .map((a) => articleToNewsItem(a, language))
      .filter(Boolean)
      .map((n) => ({ ...n, category: 'Education' as const })) as NewsItem[];

    if (mapped.length) return mapped;

    return [
      {
        id: 'yv1',
        title: 'Campus Innovators: Solar carts by GTU students',
        source: 'Youth Pulse',
        category: 'Education',
        district: 'Ahmedabad',
        summary: 'Pilot to run inside campus clusters.',
        publishedAt: new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}

export async function fetchCivicMetrics(state: string) {
  try {
    await new Promise((r) => setTimeout(r, 250));
    return {
      rainfallAlertDistricts: 3,
      waterSupplyOK: 28,
      projectsTracked: 57,
      electionNotices: 2,
    };
  } catch {
    return { rainfallAlertDistricts: 0, waterSupplyOK: 0, projectsTracked: 0, electionNotices: 0 };
  }
}
