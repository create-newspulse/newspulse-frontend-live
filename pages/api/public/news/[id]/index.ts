import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { getLocalizedArticleFields, normalizeRouteLocale, STRICT_LOCALE_POLICY } from '../../../../../lib/localizedArticleFields';
import { parsePublicNewsArticle, parsePublicNewsGroupItems } from '../../../../../lib/publicNewsApi';
import { pickFreshestArticleForLocale } from '../../../../../lib/translationGroupSync';
import { withPublicReadDeadline } from '../../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../../lib/retryAfter';

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }

  const id = String(req.query.id || '').trim();
  if (!id) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'MISSING_ID' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/news/${encodeURIComponent(id)}${qs}`;

  const requestedLocale = normalizeRouteLocale(
    asSingleQueryValue(req.query.language as any) || asSingleQueryValue(req.query.lang as any)
  );
  let retryAfter: string | undefined;

  try {
    const { status, json } = await withPublicReadDeadline(4000, async (signal) => {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          cookie: String(req.headers.cookie || ''),
          authorization: String(req.headers.authorization || ''),
        },
        cache: 'no-store',
        signal,
      });
      retryAfter = getSafeRetryAfter(upstream.headers?.get('Retry-After'));
      const json: unknown = upstream.ok ? JSON.parse(await upstream.text()) : null;
      return { status: upstream.status, json };
    });

    if (status === 404 || status === 410) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json({ ok: false, message: 'NOT_FOUND' });
    }

    if (status < 200 || status >= 300 || !json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('PUBLIC_NEWS_UNAVAILABLE');
    }
    const directArticle = parsePublicNewsArticle(json);
    if (!directArticle) throw new Error('INVALID_PUBLIC_NEWS_ARTICLE');
    let article = directArticle;
    const translationGroupId = String(article.translationGroupId || '').trim();

    if (translationGroupId) {
      try {
        const groupItems = await withPublicReadDeadline(1500, async (signal) => {
          const groupUrl = `${base}/api/public/news/group/${encodeURIComponent(translationGroupId)}${qs}`;
          const groupRes = await fetch(groupUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              cookie: String(req.headers.cookie || ''),
              authorization: String(req.headers.authorization || ''),
            },
            cache: 'no-store',
            signal,
          });
          if (groupRes.status === 404 || groupRes.status === 410) return [];
          if (!groupRes.ok) throw new Error('PUBLIC_NEWS_GROUP_UNAVAILABLE');
          const items = parsePublicNewsGroupItems(JSON.parse(await groupRes.text()));
          if (!items) throw new Error('INVALID_PUBLIC_NEWS_GROUP');
          return items;
        });
        const picked = pickFreshestArticleForLocale({
          currentArticle: article,
          groupArticles: groupItems,
          locale: requestedLocale,
          policy: STRICT_LOCALE_POLICY,
        });
        if (!picked) {
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
        }
        article = picked;
      } catch {
        // The direct read is still authoritative when the optional locale lookup fails.
        if (process.env.NODE_ENV !== 'production') console.error('[api/public/news/[id]] translation_group_unavailable');
        const directLocale = getLocalizedArticleFields(directArticle, requestedLocale, STRICT_LOCALE_POLICY);
        if (directLocale.status === 'published' && !directLocale.isVisible) {
          throw new Error('PUBLIC_NEWS_GROUP_UNAVAILABLE');
        }
      }
    }

    const localized = getLocalizedArticleFields(article, requestedLocale, STRICT_LOCALE_POLICY);
    if (!localized.isVisible) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ article });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }
}
