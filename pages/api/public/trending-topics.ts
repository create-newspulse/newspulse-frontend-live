import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { mergeTrendingTopics, normalizeTrendingTopics } from '../../../lib/getTrendingTopics';
import { EDITORIAL_TOPICS_TIMEOUT_MS, fetchEditorialTopics } from '../../../lib/publicEditorialTopics';
import { withPublicReadDeadline } from '../../../lib/publicReadDeadline';
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../../../src/config/trendingTopics';

function getApiBase(): string {
  return getPublicApiBaseUrl().trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const lang = req.query.lang ?? 'en';
  if (lang !== 'en' && lang !== 'hi' && lang !== 'gu') {
    return res.status(400).json({ ok: false, message: 'INVALID_LANGUAGE' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const base = getApiBase();
  if (!base) {
    console.warn('[trending-topics] No backend configured; using default shortcuts');
    return res.status(200).json([]);
  }

  const [editorialResult, legacyResult] = await Promise.allSettled([
    fetchEditorialTopics(lang),
    withPublicReadDeadline(EDITORIAL_TOPICS_TIMEOUT_MS, async (signal) => {
      const upstream = await fetch(`${base}/api/public/trending-topics`, {
        method: 'GET', headers: { Accept: 'application/json' }, signal,
      });
      if (!upstream.ok) throw new Error(`Legacy trending request failed (${upstream.status})`);
      // Retain the existing array/{items} contract and its fixed-shortcut fallback.
      return normalizeTrendingTopics(await upstream.json()).map(({ source, ...topic }) => topic);
    }),
  ]);
  if (editorialResult.status === 'rejected') console.warn('[trending-topics] Editorial topics unavailable', editorialResult.reason);
  if (legacyResult.status === 'rejected') console.warn('[trending-topics] Using default legacy shortcuts', legacyResult.reason);

  const editorial: TrendingTopic[] = editorialResult.status === 'fulfilled'
    ? editorialResult.value.map((topic) => ({
      key: topic.slug, label: topic.label, href: topic.href,
      colorKey: topic.colorKey === 'blue' ? 'sports' : '__default',
      source: 'editorial',
    })) : [];
  const legacy = legacyResult.status === 'fulfilled' && legacyResult.value.length
    ? legacyResult.value : DEFAULT_TRENDING_TOPICS;
  return res.status(200).json({ items: mergeTrendingTopics(editorial, legacy) });
}
