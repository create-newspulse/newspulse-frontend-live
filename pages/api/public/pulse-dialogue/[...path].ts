import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { withPublicReadDeadline } from '../../../../lib/publicReadDeadline';

const CARD_FIELDS = ['id', '_id', 'articleId', 'title', 'summary', 'description', 'slug', 'slugs', 'canonicalSlug', 'category', 'imageUrl', 'coverImageUrl', 'imageAlt', 'publishedAt', 'createdAt', 'language', 'lang', 'requestedLang', 'resolvedLang', 'isTranslated', 'isFallback', 'translationKey', 'translationGroupId', 'pulseDialogue', 'authorByline'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  const path = req.query.path;
  const simple = Array.isArray(path) && path.length === 1 && ['articles', 'discovery', 'contributors', 'series'].includes(path[0]);
  const archive = Array.isArray(path) && path.length === 3 && ['contributors', 'series'].includes(path[0]) && path[2] === 'articles' && /^[\p{L}\p{N}\p{M}-]{1,140}$/u.test(path[1]);
  if (!simple && !archive) return res.status(404).json({ ok: false });
  const allowed = path![0] === 'discovery' ? ['lang'] : path![0] === 'articles'
    ? ['lang', 'page', 'limit', 'q', 'contributor', 'seriesSlug', 'dialogueFormat', 'sort'] : ['lang', 'page', 'limit'];
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (!allowed.includes(key) || typeof value !== 'string') return res.status(400).json({ ok: false });
    query.set(key, value);
  }
  const base = getPublicApiBaseUrl();
  if (!base) return res.status(503).json({ ok: false });
  try {
    const result = await withPublicReadDeadline(3500, async (signal) => {
      const upstream = await fetch(`${base}/api/public/pulse-dialogue/${(path as string[]).map(encodeURIComponent).join('/')}?${query}`, {
        headers: { Accept: 'application/json' }, method: 'GET', cache: 'no-store', signal,
      });
      const payload = await upstream.json();
      return { status: upstream.status, payload };
    });
    if (archive && Array.isArray(result.payload?.items)) result.payload.items = result.payload.items.map((item: Record<string, unknown>) =>
      Object.fromEntries(CARD_FIELDS.filter((key) => item[key] !== undefined).map((key) => [key, item[key]])));
    return res.status(result.status).json(result.payload);
  } catch { return res.status(503).json({ ok: false }); }
}