import type { NextApiRequest, NextApiResponse } from 'next';

import { getCategoryQueryKey, getCategoryRouteKey } from '../../../lib/categoryKeys';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { filterVisibleArticlesForLocale, normalizeRouteLocale, STRICT_LOCALE_POLICY } from '../../../lib/localizedArticleFields';
import { pickFreshestArticlesForLocale } from '../../../lib/translationGroupSync';

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

function isTruthyQueryValue(value: string | string[] | undefined): boolean {
  const normalized = String(Array.isArray(value) ? value[0] : value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getPayloadItems(payload: any): any[] {
  return Array.isArray(payload) ? payload :
    Array.isArray(payload?.items) ? payload.items :
    Array.isArray(payload?.articles) ? payload.articles :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.data?.items) ? payload.data.items :
    Array.isArray(payload?.data?.articles) ? payload.data.articles :
    [];
}

function buildUpstreamUrl(base: string, params: URLSearchParams): string {
  const query = params.toString();
  return `${base}/api/public/news${query ? `?${query}` : ''}`;
}

async function fetchUpstreamJson(url: string, req: NextApiRequest): Promise<{ ok: boolean; status: number; json: any }> {
  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  });

  const text = await upstream.text().catch(() => '');
  const json = text ? JSON.parse(text) : { items: [] };
  return { ok: upstream.ok, status: upstream.status, json };
}

function debugCategoryList(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[api/public/news]', payload);
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

  const requestedLocale = normalizeRouteLocale(
    asSingleQueryValue(req.query.language as any) || asSingleQueryValue(req.query.lang as any)
  );
  const strictLocale = isTruthyQueryValue(req.query.strictLocale as any);
  const rawCategory = asSingleQueryValue(req.query.category as any);
  const routeSlug = rawCategory ? getCategoryRouteKey(rawCategory) : '';
  const normalizedCategory = rawCategory ? getCategoryQueryKey(rawCategory) : '';
  const qsIndex = (req.url || '').indexOf('?');
  const localizedParams = new URLSearchParams(qsIndex >= 0 ? (req.url || '').slice(qsIndex + 1) : '');
  const requestedLimit = Number(localizedParams.get('limit') || 0);

  if (normalizedCategory) localizedParams.set('category', normalizedCategory);

  const shouldWidenCategoryFetch = Boolean(normalizedCategory) && strictLocale;
  const targetUrl = buildUpstreamUrl(base, localizedParams);

  try {
    const upstream = await fetchUpstreamJson(targetUrl, req);
    // If backend is missing the route (or temporarily down), fail open.
    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }

    try {
      const json = upstream.json;
      const primaryItems = getPayloadItems(json);
      let listItems = Array.isArray(primaryItems) ? primaryItems : [];

      if (shouldWidenCategoryFetch) {
        try {
          const widenedParams = new URLSearchParams(localizedParams);
          widenedParams.delete('lang');
          widenedParams.delete('language');
          widenedParams.set('limit', String(Math.max(requestedLimit > 0 ? requestedLimit * 3 : 0, 90)));

          const widened = await fetchUpstreamJson(buildUpstreamUrl(base, widenedParams), req);
          if (widened.ok) {
            const widenedItems = getPayloadItems(widened.json);
            listItems = [
              ...(Array.isArray(primaryItems) ? primaryItems : []),
              ...(Array.isArray(widenedItems) ? widenedItems : []),
            ];
          }
        } catch {
          // Keep the locale-specific list when the wider translation-group fetch is unavailable.
        }
      }

      // Enforce a single public-content contract:
      // - never return unpublished/deleted items
      // - never return cross-locale items unless translation is APPROVED
      const itemsResolved = shouldWidenCategoryFetch
        ? pickFreshestArticlesForLocale({
            articles: listItems,
            locale: requestedLocale,
            policy: strictLocale ? STRICT_LOCALE_POLICY : undefined,
          })
        : filterVisibleArticlesForLocale(
            listItems,
            requestedLocale,
            strictLocale ? STRICT_LOCALE_POLICY : undefined
          );
      const items = requestedLimit > 0 ? itemsResolved.slice(0, requestedLimit) : itemsResolved;
      const normalized = replaceItems(json, items);

      debugCategoryList({
        locale: requestedLocale,
        routeSlug: routeSlug || rawCategory || null,
        normalizedCategory: normalizedCategory || null,
        numberOfStoriesReturned: items.length,
        storyIds: items.map((item) => String(item?._id || item?.id || '').trim() || null),
        translationGroupIds: items.map((item) => String(item?.translationGroupId || '').trim() || null),
      });

      // Avoid stale listings after delete/unpublish; accuracy over cache.
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(normalized);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items: [] });
  }
}
