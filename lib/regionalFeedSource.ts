import {
  dedupeRegionalFeedPayload,
  filterRegionalFeedPayload,
  unwrapRegionalFeedItems,
} from './unwrapRegionalFeed';
import { normalizeRouteLocale } from './localizedArticleFields';

import { getRegionalPagination, REGIONAL_BLOCKED_IDS as BLOCKED_IDS, type RegionalPagination } from './regionalInitialStories';

type RegionalFeedSourceRequest = {
  base: string;
  url?: string;
  query: Record<string, string | string[] | undefined>;
  headers: { cookie?: string; authorization?: string };
  signal?: AbortSignal;
};

type RegionalFeedSourceResult = {
  status: number;
  payload: unknown;
  pagination?: RegionalPagination;
  upstreamError?: unknown;
};

function shouldKeepRegionalItem(item: any): boolean {
  const id = String(item?._id || item?.id || '').trim();
  if (id && BLOCKED_IDS.has(id)) return false;

  // Enforce public visibility.
  const statusRaw = String(item?.status || item?.state || '').toLowerCase().trim();
  const deleted = item?.deleted === true || item?.isDeleted === true || !!item?.deletedAt;
  if (deleted) return false;
  if (statusRaw === 'deleted' || statusRaw === 'removed' || statusRaw === 'trash') return false;
  if (item?.isPublished === false || item?.published === false) return false;

  // If an explicit status exists, require it be published.
  if (statusRaw) return statusRaw === 'published';

  // If status is missing, require some other "published" marker.
  const hasPublishedAt = Boolean(String(item?.publishedAt || '').trim());
  const isPublishedTrue = item?.isPublished === true || item?.published === true;
  if (hasPublishedAt || isPublishedTrue) return true;

  // Unknown status with no publish markers: not safe for public listing.
  return false;

  // (unreachable)
}

function isLocaleCompatible(item: any, requestedLocale: 'en' | 'hi' | 'gu'): boolean {
  const rawLang = String(item?.language || item?.lang || item?.sourceLang || item?.sourceLanguage || '').trim();
  if (!rawLang) return true;
  return normalizeRouteLocale(rawLang) === requestedLocale;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (init.signal?.aborted) throw new Error('Regional read cancelled');
  // Initial loads already have a deadline covering both response headers and body.
  if (init.signal) return fetch(url, init);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function safeJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function sanitizeRegionalQuery(qs: string, options: { state?: string; lang?: string }) {
  const params = new URLSearchParams(String(qs || '').replace(/^\?/, ''));

  const state = String(options.state || '').trim();
  if (state) params.set('state', state);

  const lang = String(options.lang || '').trim();
  if (lang) params.set('lang', lang);

  const stateSlug = normalizeGeoToken(params.get('state'));

  for (const k of ['district', 'districtSlug', 'city', 'citySlug'] as const) {
    const raw = params.get(k);
    if (raw == null) continue;

    const token = normalizeGeoToken(raw);
    if (isInvalidOptionalToken(token) || (stateSlug && token === stateSlug)) {
      params.delete(k);
    }
  }

  const out = params.toString();
  return {
    params,
    qs: out ? `?${out}` : '',
    stateSlug,
  };
}

function normalizeGeoToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(state|district|city)\s*[:=\-]\s*/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isInvalidOptionalToken(value: string): boolean {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'undefined' || v === 'null' || v === 'none';
}

function tagList(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').toLowerCase().trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => String(t || '').toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

function filterByStateDistrict(items: any[], stateSlug: string, districtSlug: string): any[] {
  let next = Array.isArray(items) ? items : [];
  if (!next.length) return next;

  if (stateSlug) {
    const wanted = `state:${stateSlug}`;
    const matches = next.filter((it) => {
      const tags = tagList(it?.tags);
      if (tags.includes(wanted)) return true;
      const state = normalizeGeoToken(it?.state || it?.stateSlug || it?.region?.state || it?.location?.state);
      return !!state && state === stateSlug;
    });
    if (matches.length) next = matches;
  }

  if (districtSlug) {
    const wanted = `district:${districtSlug}`;
    const matches = next.filter((it) => {
      const tags = tagList(it?.tags);
      if (tags.includes(wanted)) return true;
      const district = normalizeGeoToken(
        it?.district || it?.districtSlug || it?.location?.district || it?.geo?.district || it?.region?.district
      );
      return !!district && district === districtSlug;
    });
    if (matches.length) next = matches;
  }

  return next;
}

function setPayloadItems(payload: any, items: any[]): any {
  if (Array.isArray(payload)) return items;
  if (!payload || typeof payload !== 'object') return items;

  if (Array.isArray((payload as any).data)) {
    return { ...(payload as any), data: items };
  }

  if ((payload as any).data && typeof (payload as any).data === 'object') {
    const data = (payload as any).data;
    if (Array.isArray(data.items)) return { ...(payload as any), data: { ...data, items } };
    if (Array.isArray(data.stories)) return { ...(payload as any), data: { ...data, stories: items } };
    if (Array.isArray(data.articles)) return { ...(payload as any), data: { ...data, articles: items } };
  }

  if (Array.isArray((payload as any).items)) return { ...(payload as any), items };
  if (Array.isArray((payload as any).stories)) return { ...(payload as any), stories: items };
  if (Array.isArray((payload as any).articles)) return { ...(payload as any), articles: items };

  return { ...(payload as any), items };
}

function readPositiveLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function limitRegionalPayload(payload: any, limit: number): any {
  if (!limit) return payload;
  const items = unwrapRegionalFeedItems(payload);
  if (!items.length || items.length <= limit) return payload;
  return setPayloadItems(payload, items.slice(0, limit));
}

async function fetchRegionalFallbackFromNews(options: {
  base: string;
  qs: string;
  requestedLang: string;
  stateSlug: string;
  districtSlug: string;
  upstreamInit: RequestInit;
  timeoutMs: number;
}): Promise<any | null> {
  const params = new URLSearchParams((options.qs || '').replace(/^\?/, ''));
  params.set('category', 'regional');
  const language = normalizeRouteLocale(options.requestedLang);
  params.set('lang', language);
  params.set('language', language);

  // Exact Regional News is the Gujarat category; historical records may lack state metadata.
  const isGujaratCategory = options.stateSlug === 'gujarat';
  if (isGujaratCategory) {
    params.delete('state');
    params.delete('stateSlug');
  }

  // Guard against accidental empty/undefined filters which can yield an empty upstream response.
  for (const k of ['district', 'districtSlug', 'city', 'citySlug'] as const) {
    const raw = params.get(k);
    if (raw != null && isInvalidOptionalToken(normalizeGeoToken(raw))) params.delete(k);
  }

  const tryFetch = async (tryParams: URLSearchParams): Promise<any | null> => {
    const url = `${options.base}/api/public/news?${tryParams.toString()}`;
    try {
      const upstream = await fetchWithTimeout(url, options.upstreamInit, options.timeoutMs);
      const text = await upstream.text().catch(() => '');
      if (upstream.status === 404) return null;
      if (!upstream.ok) return null;
      return safeJson(text);
    } catch {
      return null;
    }
  };

  const json = await tryFetch(params);
  if (json == null) return null;
  const pagination = params.has('page') ? getRegionalPagination(json, { page: params.get('page'), limit: params.get('limit') }) : undefined;
  const items = unwrapRegionalFeedItems(json).filter((item) => item?.category === 'regional');
  const filteredItems = filterByStateDistrict(items, isGujaratCategory ? '' : options.stateSlug, options.districtSlug);
  const payload = setPayloadItems(json, filteredItems);
  return pagination ? { ...(Array.isArray(payload) ? { items: payload } : payload), pagination } : payload;
}

function itemHasUsefulGeoOrTags(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const tags = tagList(item?.tags);
  if (tags.length) return true;
  if (typeof item?.status === 'string') return true;
  if (item?.isPublished === true || item?.published === true) return true;
  if (item?.district || item?.city) return true;
  if (item?.location?.district || item?.location?.city) return true;
  return false;
}

function isLowFidelityRegionalFeed(items: any[]): boolean {
  const input = Array.isArray(items) ? items : [];
  if (!input.length) return false;
  const sample = input.slice(0, 3);
  return sample.every((it) => !itemHasUsefulGeoOrTags(it));
}

export async function fetchRegionalFeedSource(req: RegionalFeedSourceRequest): Promise<RegionalFeedSourceResult> {
  const base = req.base;
  const debug = String(process.env.DEBUG_PUBLIC_REGIONAL || '').trim() === '1';
  const debugLog = (...args: any[]) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.log('[api/public/regional]', ...args);
  };

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';

  const langRaw = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
  const languageRaw = Array.isArray(req.query.language) ? req.query.language[0] : req.query.language;
  const requestedLang = String(langRaw || languageRaw || '').trim();
  const requestedLocale = normalizeRouteLocale(requestedLang);

  const stateFromQuery = asSingleQueryValue(req.query.state) || asSingleQueryValue(req.query.stateSlug);
  const sanitized = sanitizeRegionalQuery(qs, { state: stateFromQuery, lang: requestedLang });

  const upstreamInit: RequestInit = {
    method: 'GET',
    cache: 'no-store',
    signal: req.signal,
    headers: {
      Accept: 'application/json',
      'cache-control': 'no-store',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  };

  const timeoutMs = Number(process.env.PUBLIC_REGIONAL_UPSTREAM_TIMEOUT_MS || 10000);

  const stateSlugRaw = normalizeGeoToken(stateFromQuery);
  const districtSlugRaw = normalizeGeoToken(
    asSingleQueryValue(req.query.districtSlug) || asSingleQueryValue(req.query.district)
  );

  const stateSlug = isInvalidOptionalToken(stateSlugRaw) ? '' : stateSlugRaw;
  const districtSlug = isInvalidOptionalToken(districtSlugRaw) ? '' : districtSlugRaw;
  const requestedLimit = readPositiveLimit(req.query.limit as any);

  const citySlugRaw = normalizeGeoToken(asSingleQueryValue(req.query.citySlug) || asSingleQueryValue(req.query.city));
  const citySlug = isInvalidOptionalToken(citySlugRaw) ? '' : citySlugRaw;

  const wantsGeoFilter = !!districtSlug || !!citySlug;

  const successfulResult = (raw: unknown, filtered: unknown): RegionalFeedSourceResult => ({
    status: 200,
    payload: limitRegionalPayload(filtered, requestedLimit),
    ...(req.query.page !== undefined ? {
      pagination: getRegionalPagination(raw, {
        page: asSingleQueryValue(req.query.page),
        limit: requestedLimit || 30,
      }),
    } : {}),
  });

  const fetchFilteredNewsFallback = async (): Promise<RegionalFeedSourceResult | null> => {
    const fallback = await fetchRegionalFallbackFromNews({
      base,
      qs: sanitized.qs,
      requestedLang,
      stateSlug,
      districtSlug,
      upstreamInit,
      timeoutMs,
    });
    if (fallback == null) return null;

    const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
    const filteredFallback = filterRegionalFeedPayload(
      dedupedFallback,
      (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale)
    );
    return successfulResult(fallback, filteredFallback);
  };

  // Preferred upstream endpoint (query-string based): /api/public/regional?state=...
  const primaryUrl = `${base}/api/public/regional${sanitized.qs}`;

  try {
    debugLog('request', {
      url: req.url,
      requestedLang,
      requestedLocale,
      state: stateSlug || stateFromQuery || null,
      district: districtSlug || null,
      city: citySlug || null,
      primaryUrl,
    });

    const upstream = await fetchWithTimeout(primaryUrl, upstreamInit, timeoutMs);
    const text = await upstream.text().catch(() => '');

    debugLog('upstream', {
      status: upstream.status,
      cacheControl: upstream.headers.get('cache-control'),
      age: upstream.headers.get('age'),
      via: upstream.headers.get('via'),
      xCache: upstream.headers.get('x-cache'),
      xVercelCache: upstream.headers.get('x-vercel-cache'),
    });

    // Backward compatibility: some deployments used /api/public/regional/:state
    // If the query endpoint 404s but we have a state param, try the legacy path endpoint.
    if (upstream.status === 404) {
      const stateRaw = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
      const state = String(stateRaw || '').trim();
      if (state) {
        const legacyUrl = `${base}/api/public/regional/${encodeURIComponent(state)}${sanitized.qs}`;
        const legacy = await fetchWithTimeout(legacyUrl, upstreamInit, timeoutMs);
        const legacyText = await legacy.text().catch(() => '');

        debugLog('upstream-legacy', {
          url: legacyUrl,
          status: legacy.status,
          cacheControl: legacy.headers.get('cache-control'),
          age: legacy.headers.get('age'),
          xVercelCache: legacy.headers.get('x-vercel-cache'),
        });
        if (!legacy.ok) {
          if (legacy.status >= 500) {
            const fallback = await fetchFilteredNewsFallback();
            if (fallback == null) {
              return { status: 200, payload: [], upstreamError: new Error(`Regional feed unavailable (${legacy.status})`) };
            }
            return fallback;
          }
          return { status: legacy.status, payload: { ok: false, message: 'UPSTREAM_ERROR', status: legacy.status } };
        }

        const legacyJson = safeJson(legacyText);
        const deduped = dedupeRegionalFeedPayload(legacyJson ?? [], requestedLang);
        if (debug) {
          const rawItems = unwrapRegionalFeedItems(deduped);
          const keptItems = unwrapRegionalFeedItems(
            filterRegionalFeedPayload(deduped, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale))
          );
          const removed = rawItems
            .filter((it) => !shouldKeepRegionalItem(it) || !isLocaleCompatible(it, requestedLocale))
            .slice(0, 12)
            .map((it) => ({
              id: String(it?._id || it?.id || '').trim(),
              status: String(it?.status || it?.state || '').trim(),
              deleted: Boolean(it?.deleted === true || it?.isDeleted === true || it?.deletedAt),
              isPublished: it?.isPublished,
              published: it?.published,
              lang: String(it?.language || it?.lang || it?.sourceLang || '').trim(),
              title: String(it?.title || '').slice(0, 80),
            }));
          debugLog('filter', { mode: 'legacy', rawCount: rawItems.length, keptCount: keptItems.length, removedPreview: removed });
        }

        const filtered = filterRegionalFeedPayload(deduped, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));

        // If upstream returns an empty feed, fall back to Regional News.
        if (!unwrapRegionalFeedItems(filtered).length) {
          const fallback = await fetchRegionalFallbackFromNews({
            base,
            qs: sanitized.qs,
            requestedLang,
            stateSlug,
            districtSlug,
            upstreamInit,
            timeoutMs,
          });
          if (fallback) {
            const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
            const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
            return successfulResult(fallback, filteredFallback);
          }
          return { status: 200, payload: limitRegionalPayload(filtered, requestedLimit), upstreamError: new Error('Regional News fallback unavailable') };
        }

        return successfulResult(legacyJson, filtered);
      }
    }

    if (!upstream.ok) {
      if (upstream.status >= 500) {
        const fallback = await fetchFilteredNewsFallback();
        if (fallback == null) {
          return { status: 200, payload: [], upstreamError: new Error(`Regional feed unavailable (${upstream.status})`) };
        }
        return fallback;
      }
      return { status: upstream.status, payload: { ok: false, message: 'UPSTREAM_ERROR', status: upstream.status } };
    }

    const json = safeJson(text);
    const deduped = dedupeRegionalFeedPayload(json ?? [], requestedLang);
    if (debug) {
      const rawItems = unwrapRegionalFeedItems(deduped);
      const keptItems = unwrapRegionalFeedItems(
        filterRegionalFeedPayload(deduped, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale))
      );
      const removed = rawItems
        .filter((it) => !shouldKeepRegionalItem(it) || !isLocaleCompatible(it, requestedLocale))
        .slice(0, 12)
        .map((it) => ({
          id: String(it?._id || it?.id || '').trim(),
          status: String(it?.status || it?.state || '').trim(),
          deleted: Boolean(it?.deleted === true || it?.isDeleted === true || it?.deletedAt),
          isPublished: it?.isPublished,
          published: it?.published,
          lang: String(it?.language || it?.lang || it?.sourceLang || '').trim(),
          title: String(it?.title || '').slice(0, 80),
        }));
      debugLog('filter', { mode: 'primary', rawCount: rawItems.length, keptCount: keptItems.length, removedPreview: removed });
    }

    const filtered = filterRegionalFeedPayload(deduped, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));

    // Some upstream deployments return a low-fidelity feed (no tags/status/geo),
    // which breaks district/city pages and client-side filtering.
    // When this happens (or when geo filters are requested), prefer the Regional News category.
    const upstreamItems = unwrapRegionalFeedItems(filtered);
    const shouldPreferFallback = wantsGeoFilter || isLowFidelityRegionalFeed(upstreamItems);
    if (shouldPreferFallback) {
      const fallback = await fetchRegionalFallbackFromNews({
        base,
        qs: sanitized.qs,
        requestedLang,
        stateSlug,
        districtSlug,
        upstreamInit,
        timeoutMs,
      });
      if (fallback) {
        const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
        const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
        if (unwrapRegionalFeedItems(filteredFallback).length) return successfulResult(fallback, filteredFallback);
      }
    }

    // Fallback: some deployments have /api/public/regional wired up but returning empty.
    // Use /api/public/news?category=regional as a source-of-truth.
    if (!unwrapRegionalFeedItems(filtered).length) {
      const fallback = await fetchRegionalFallbackFromNews({
        base,
        qs: sanitized.qs,
        requestedLang,
        stateSlug,
        districtSlug,
        upstreamInit,
        timeoutMs,
      });
      if (fallback) {
        const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
        const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
        return successfulResult(fallback, filteredFallback);
      }
      return { status: 200, payload: limitRegionalPayload(filtered, requestedLimit), upstreamError: new Error('Regional News fallback unavailable') };
    }

    return successfulResult(json, filtered);
  } catch (e: unknown) {
    if (req.signal?.aborted) throw e;
    const fallback = await fetchFilteredNewsFallback().catch(() => null);
    if (fallback != null) return fallback;

    return { status: 200, payload: [], upstreamError: e };
  }
}
