import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { anonymousArticleGet } from '../../../../lib/publicArticleRequest';
import { parsePublicNewsArticle } from '../../../../lib/publicNewsApi';
import { getPublicArticleStatus } from '../../../../lib/localizedArticleFields';
import { withPublicReadDeadline } from '../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../lib/retryAfter';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/news/translation${qs}`;

  try {
    const { status, article } = await withPublicReadDeadline(4000, async signal => {
      const upstream = await fetch(targetUrl, anonymousArticleGet(signal));
      const retry = getSafeRetryAfter(upstream.headers.get('Retry-After'));
      if (retry) res.setHeader('Retry-After', retry);
      if (!upstream.ok) { await upstream.body?.cancel(); return { status: upstream.status, article: null }; }
      return { status: upstream.status, article: parsePublicNewsArticle(await upstream.json()) };
    });
    if (status === 404 || status === 410) return res.status(status).json({ ok: false, message: 'NOT_FOUND' });
    if (status === 400) return res.status(400).json({ error: 'INVALID_PUBLIC_NEWS_REQUEST' });
    if (!article) return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
    if (getPublicArticleStatus(article) !== 'published') return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    return res.status(200).json(article);
  } catch {
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }
}
