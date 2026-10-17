import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { EDITORIAL_TOPIC_PAGE_SIZE, fetchEditorialTopic, fetchEditorialTopicStories } from '../../../../lib/publicEditorialTopics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }
  const parts = req.query.path;
  if (!Array.isArray(parts) || !/^[\p{L}\p{N}\p{M}-]{1,140}$/u.test(parts[0] || '')
    || (parts.length !== 1 && !(parts.length === 2 && parts[1] === 'articles'))) {
    return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
  }
  const lang = req.query.lang ?? 'en';
  if (lang !== 'en' && lang !== 'hi' && lang !== 'gu') {
    return res.status(400).json({ ok: false, message: 'INVALID_LANGUAGE' });
  }
  const rawPage = req.query.page ?? '1';
  const page = typeof rawPage === 'string' && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : NaN;
  if (parts.length === 2 && (!Number.isSafeInteger(page) || page > 10000
    || (req.query.limit !== undefined && req.query.limit !== String(EDITORIAL_TOPIC_PAGE_SIZE)))) {
    return res.status(400).json({ ok: false, message: 'INVALID_PAGINATION' });
  }

  try {
    if (!getPublicApiBaseUrl()) throw new Error('Public backend is not configured');
    if (parts.length === 2) {
      const stories = await fetchEditorialTopicStories(parts[0], lang, page);
      return res.status(200).json({ ok: true, ...stories, count: stories.items.length });
    }
    const detail = await fetchEditorialTopic(parts[0], lang);
    if (!detail) return res.status(404).json({ ok: false, message: 'TOPIC_NOT_FOUND' });
    return res.status(200).json({ ok: true, ...detail });
  } catch (error) {
    console.error('[editorial-topics] Public topic read unavailable', error);
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ ok: false, message: 'EDITORIAL_TOPIC_UNAVAILABLE' });
  }
}
