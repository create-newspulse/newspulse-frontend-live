import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { getLocalizedArticleFields, normalizeRouteLocale } from '../../../../../lib/localizedArticleFields';
import { unwrapArticle } from '../../../../../lib/publicNewsApi';

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

  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(400).json({ ok: false, message: 'MISSING_SLUG' });

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ article: null });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';

  // Backend contract: /api/public/news/slug/:slug?lang=...
  const targetUrl = `${base}/api/public/news/slug/${encodeURIComponent(slug)}${qs}`;

  const requestedLocale = normalizeRouteLocale(
    asSingleQueryValue(req.query.language as any) || asSingleQueryValue(req.query.lang as any)
  );

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ article: null });
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ article: null });
    }

    try {
      const json = text ? JSON.parse(text) : { article: null };
      const article = unwrapArticle(json);
      const localized = getLocalizedArticleFields(article, requestedLocale);
      if (!localized.isVisible) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({ article: null });
      }

      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ article: null });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ article: null });
  }
}
