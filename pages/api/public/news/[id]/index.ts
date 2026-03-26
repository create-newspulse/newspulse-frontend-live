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

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }

  const id = String(req.query.id || '').trim();
  if (!id) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'MISSING_ID' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const originalParams = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);

  const buildTargetUrl = (langOverride: string | null): string => {
    const params = new URLSearchParams(originalParams);
    if (langOverride) {
      params.set('lang', langOverride);
      params.set('language', langOverride);
    } else {
      params.delete('lang');
      params.delete('language');
    }
    const query = params.toString();
    return `${base}/api/public/news/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
  };

  const requestedLocale = normalizeRouteLocale(
    asSingleQueryValue(req.query.language as any) || asSingleQueryValue(req.query.lang as any)
  );

  try {
    const headers = {
      Accept: 'application/json',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    };

    const targetUrl = buildTargetUrl(requestedLocale);
    const upstream = await fetch(targetUrl, { method: 'GET', headers, cache: 'no-store' as any });
    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404 || !upstream.ok) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    const article = unwrapArticle(json);
    if (!article?._id) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    const strict = getLocalizedArticleFields(article, requestedLocale);
    if (!strict.isVisible) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(json);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }
}
