import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import {
  dedupeRegionalFeedPayload,
  filterRegionalFeedPayload,
  unwrapRegionalFeedItems,
} from '../../../../lib/unwrapRegionalFeed';
import { normalizeRouteLocale } from '../../../../lib/localizedArticleFields';

const BLOCKED_IDS = new Set<string>([
  '69a9d5f74c3cb9a18ef5a179',
  '69a9ca4a4c3cb9a18ef5a16f',
  // Proven stale/deleted cards still appearing in public regional feeds.
  '69c0c4707c7cb68a34add518',
  '69c029fb7c7cb68a34add2ee',
]);

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

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '')
    .trim()
    .replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
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

async function fetchRegionalFallbackFromStories(options: {
  base: string;
  qs: string;
  requestedLang: string;
  explicitLanguage: boolean;
  stateSlug: string;
  districtSlug: string;
  upstreamInit: RequestInit;
  timeoutMs: number;
}): Promise<any | null> {
  const params = new URLSearchParams((options.qs || '').replace(/^\?/, ''));
  params.set('category', 'regional');

  // Guard against accidental empty/undefined filters which can yield an empty upstream response.
  for (const k of ['district', 'districtSlug', 'city', 'citySlug'] as const) {
    const raw = params.get(k);
    if (raw != null && isInvalidOptionalToken(normalizeGeoToken(raw))) params.delete(k);
  }

  // Backends have varied semantics for `lang`.
  // We treat `language` as a stricter content-language filter.
  // When the caller did not explicitly provide `language`, we apply it implicitly based on requested UI lang,
  // but allow a retry without it if it yields an empty result.
  const implicitLanguage = normalizeGeoToken(options.requestedLang);
  const usedImplicitLanguage = !!(!options.explicitLanguage && implicitLanguage && !params.get('language'));
  if (usedImplicitLanguage) params.set('language', implicitLanguage);

  const langParam = params.get('lang');
  if (langParam) params.set('lang', String(langParam).trim().toUpperCase());

  const tryFetch = async (tryParams: URLSearchParams): Promise<any | null> => {
    const url = `${options.base}/api/public/stories?${tryParams.toString()}`;
    const upstream = await fetchWithTimeout(url, options.upstreamInit, options.timeoutMs);
    const text = await upstream.text().catch(() => '');
    if (upstream.status === 404) return null;
    if (!upstream.ok) return null;
    return safeJson(text);
  };

  const json = await tryFetch(params);
  const items = unwrapRegionalFeedItems(json ?? []);
  if (!items.length && usedImplicitLanguage) {
    const relaxed = new URLSearchParams(params.toString());
    relaxed.delete('language');
    const relaxedJson = await tryFetch(relaxed);
    if (relaxedJson != null) {
      const relaxedItems = unwrapRegionalFeedItems(relaxedJson ?? []);
      const relaxedFiltered = filterByStateDistrict(relaxedItems, options.stateSlug, options.districtSlug);
      return setPayloadItems(relaxedJson, relaxedFiltered);
    }
  }

  if (!items.length) return json;
  const filteredItems = filterByStateDistrict(items, options.stateSlug, options.districtSlug);
  return setPayloadItems(json, filteredItems);
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Prevent edge/browser caching; regional feeds must reflect deletes/unpublishes quickly.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const debug = String(process.env.DEBUG_PUBLIC_REGIONAL || '').trim() === '1';
  const debugLog = (...args: any[]) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.log('[api/public/regional]', ...args);
  };

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

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

  const citySlugRaw = normalizeGeoToken(asSingleQueryValue(req.query.citySlug) || asSingleQueryValue(req.query.city));
  const citySlug = isInvalidOptionalToken(citySlugRaw) ? '' : citySlugRaw;

  const explicitLanguage = !!(Array.isArray(req.query.language) ? req.query.language[0] : req.query.language);
  const wantsGeoFilter = !!districtSlug || !!citySlug;

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
          return res.status(legacy.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: legacy.status });
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

        // If upstream returns an empty feed, fall back to public stories.
        if (!unwrapRegionalFeedItems(filtered).length) {
          const fallback = await fetchRegionalFallbackFromStories({
            base,
            qs: sanitized.qs,
            requestedLang,
            explicitLanguage,
            stateSlug,
            districtSlug,
            upstreamInit,
            timeoutMs,
          });
          if (fallback) {
            const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
            const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
            return res.status(200).json(filteredFallback);
          }
        }

        return res.status(200).json(filtered);
      }
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status });
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
    // When this happens (or when geo filters are requested), prefer /api/public/stories as the source-of-truth.
    const upstreamItems = unwrapRegionalFeedItems(filtered);
    const shouldPreferFallback = wantsGeoFilter || isLowFidelityRegionalFeed(upstreamItems);
    if (shouldPreferFallback) {
      const fallback = await fetchRegionalFallbackFromStories({
        base,
        qs: sanitized.qs,
        requestedLang,
        explicitLanguage,
        stateSlug,
        districtSlug,
        upstreamInit,
        timeoutMs,
      });
      if (fallback) {
        const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
        const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
        if (unwrapRegionalFeedItems(filteredFallback).length) return res.status(200).json(filteredFallback);
      }
    }

    // Fallback: some deployments have /api/public/regional wired up but returning empty.
    // Use /api/public/stories?category=regional as a source-of-truth.
    if (!unwrapRegionalFeedItems(filtered).length) {
      const fallback = await fetchRegionalFallbackFromStories({
        base,
        qs: sanitized.qs,
        requestedLang,
        explicitLanguage,
        stateSlug,
        districtSlug,
        upstreamInit,
        timeoutMs,
      });
      if (fallback) {
        const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
        const filteredFallback = filterRegionalFeedPayload(dedupedFallback, (it) => shouldKeepRegionalItem(it) && isLocaleCompatible(it, requestedLocale));
        return res.status(200).json(filteredFallback);
      }
    }

    return res.status(200).json(filtered);
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const msg = String(e?.name || '').includes('Abort') ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED';
    const status = msg === 'UPSTREAM_TIMEOUT' ? 504 : 502;
    return res.status(status).json({ ok: false, message: msg, status });
  }
}
