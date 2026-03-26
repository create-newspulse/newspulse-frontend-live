import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { normalizeRouteLocale } from '../../../lib/localizedArticleFields';
import { canonicalizePublishedStoryGroups } from '../../../lib/canonicalPublishedGroups';

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function replaceItems(payload: any, nextItems: any[]): any {
  if (Array.isArray(payload)) return nextItems;
  if (!payload || typeof payload !== 'object') return { items: nextItems };

  if (Array.isArray((payload as any).items)) return { ...(payload as any), items: nextItems };
  if (Array.isArray((payload as any).articles)) return { ...(payload as any), articles: nextItems };
  if (Array.isArray((payload as any).data)) return { ...(payload as any), data: nextItems };
  if ((payload as any).data && typeof (payload as any).data === 'object') {
    const data = (payload as any).data;
    if (Array.isArray(data.items)) return { ...(payload as any), data: { ...data, items: nextItems } };
    if (Array.isArray(data.articles)) return { ...(payload as any), data: { ...data, articles: nextItems } };
  }

  return { ...(payload as any), items: nextItems };
}

function getApiBase(): string {
  // Use the same env resolution as the rest of the app.
  // Supports NEXT_PUBLIC_API_BASE and the split NEXT_PUBLIC_API_BASE_PROD/DEV.
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    // Keep UI alive even if env not configured.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items: [], total: 0, page: 1, totalPages: 1, limit: 0 });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';

  const baseUrl = `${base}/api/public/news`;
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
    return `${baseUrl}${query ? `?${query}` : ''}`;
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

    // Enforce strict locale-only behavior:
    // - Always request the requested locale from upstream (defaulting to 'en').
    // - Never fall back to other locales.
    const targetUrl = buildTargetUrl(requestedLocale);
    const upstream = await fetch(targetUrl, { method: 'GET', headers, cache: 'no-store' as any });
    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404 || !upstream.ok) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ items: [], total: 0, page: 1, totalPages: 1, limit: 0 });
    }

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : { items: [] };
    } catch {
      json = { items: [] };
    }

    const itemsRaw =
      Array.isArray(json) ? json :
      Array.isArray(json?.items) ? json.items :
      Array.isArray(json?.articles) ? json.articles :
      Array.isArray(json?.data) ? json.data :
      Array.isArray(json?.data?.items) ? json.data.items :
      Array.isArray(json?.data?.articles) ? json.data.articles :
      [];

    const picked = canonicalizePublishedStoryGroups(Array.isArray(itemsRaw) ? itemsRaw : [], requestedLocale);
    const normalized = replaceItems(json || { items: [] }, picked);
    // Accuracy over cache; never serve stale story groups.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(normalized);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items: [] });
  }
}
