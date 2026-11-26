import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { anonymousArticleGet } from '../../../../lib/publicArticleRequest';
import { withPublicReadDeadline } from '../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../lib/retryAfter';
import { failedPublicNewsPayload, isLegacyMissingArticle, parsePublicNewsArticle, parsePublicNewsList } from '../../../../lib/publicNewsApi';
import { getPublicArticleStatus } from '../../../../lib/localizedArticleFields';

// The legacy aliases return backend DTOs, not the local ID/slug proxy envelopes.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const parts = req.query.parts ?? [];
  if (!Array.isArray(parts) || parts.length > 2 ||
      (parts.length === 2 && !['slug', 'group', 'translations'].includes(parts[0])) ||
      parts.some(part => !part || part === '.' || part === '..' || /[/\\]/.test(part))) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const base = getPublicApiBaseUrl();
  if (!base) return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  try {
    const url = new URL(`${base}/admin-api/public/news${parts.map(part => `/${encodeURIComponent(part)}`).join('')}`);
    const requestUrl = req.url || '';
    const query = requestUrl.indexOf('?');
    if (query >= 0) url.search = requestUrl.slice(query);
    const { status, body, retryAfter } = await withPublicReadDeadline(4000, async signal => {
      const upstream = await fetch(url.toString(), anonymousArticleGet(signal));
      const retryAfter = getSafeRetryAfter(upstream.headers.get('Retry-After'));
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return { status: upstream.status, body: null, retryAfter };
      }
      const payload: unknown = await upstream.json();
      if (!parts.length || parts[0] === 'breaking' || (parts.length === 2 && parts[0] !== 'slug')) {
        const list = parsePublicNewsList(payload);
        if (!list || list.items.some(item => getPublicArticleStatus(item) !== 'published')) throw new Error('Invalid public News list');
        return { status: upstream.status, body: list.payload, retryAfter };
      }
      if (isLegacyMissingArticle(payload)) return { status: upstream.status, body: payload, retryAfter };
      if (parts[0] === 'slug' && payload && typeof payload === 'object' && !failedPublicNewsPayload(payload) &&
          'article' in payload && payload.article === null) return { status: upstream.status, body: { article:null }, retryAfter };
      const article = parsePublicNewsArticle(payload);
      if (!article) throw new Error('Invalid public News article');
      if (getPublicArticleStatus(article) !== 'published') return { status: 404, body: null, retryAfter };
      const body = payload && typeof payload === 'object' && 'article' in payload ? { article }
        : payload && typeof payload === 'object' && 'data' in payload ? { data:article } : article;
      return { status: upstream.status, body, retryAfter };
    });
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    if (status < 200 || status >= 300) {
      const missing = status === 404 || status === 410;
      return res.status(missing || status === 400 ? status : 503).json({
        error: missing ? 'NOT_FOUND' : status === 400 ? 'INVALID_PUBLIC_NEWS_REQUEST' : 'PUBLIC_NEWS_UNAVAILABLE',
      });
    }
    return req.method === 'HEAD' ? res.status(status).end() : res.status(status).json(body);
  } catch {
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }
}
