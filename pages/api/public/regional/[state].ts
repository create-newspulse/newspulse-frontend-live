import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import {
  dedupeRegionalFeedPayload,
  filterRegionalFeedPayload,
  unwrapRegionalFeedItems,
} from '../../../../lib/unwrapRegionalFeed';

const BLOCKED_SLUGS = new Set<string>([
  'final-result-of-unarmed-psi-recruitment-announced-472-candidates-will-become-keeper-of-khaki',
]);

const BLOCKED_IDS = new Set<string>([
  '69a9d5f74c3cb9a18ef5a179',
  '69a9ca4a4c3cb9a18ef5a16f',
]);

function shouldKeepRegionalItem(item: any): boolean {
  const id = String(item?._id || item?.id || '').trim();
  if (id && BLOCKED_IDS.has(id)) return false;

  const slug = String(item?.slug || '').trim();
  if (slug && BLOCKED_SLUGS.has(slug)) return false;

  const slugs = item?.slugs;
  if (slugs && typeof slugs === 'object') {
    for (const v of Object.values(slugs)) {
      const s = String(v || '').trim();
      if (s && BLOCKED_SLUGS.has(s)) return false;
    }
  }

  return true;
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

function sanitizeRegionalQuery(qs: string, options: { state: string; lang?: string }) {
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

  // This route encodes state in the path already.
  params.delete('state');
  params.delete('stateSlug');

  const out = params.toString();
  return {
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
  stateSlug: string;
  districtSlug: string;
  timeoutMs: number;
}): Promise<any | null> {
  const params = new URLSearchParams((options.qs || '').replace(/^\?/, ''));
  params.set('category', 'regional');

  for (const k of ['district', 'districtSlug', 'city', 'citySlug'] as const) {
    const raw = params.get(k);
    if (raw != null && isInvalidOptionalToken(normalizeGeoToken(raw))) params.delete(k);
  }
  const lang = normalizeGeoToken(options.requestedLang);
  if (lang && !params.get('language')) params.set('language', lang);
  const langParam = params.get('lang');
  if (langParam) params.set('lang', String(langParam).trim().toUpperCase());

  const url = `${options.base}/api/public/stories?${params.toString()}`;
  const upstream = await fetchWithTimeout(url, { method: 'GET', headers: { Accept: 'application/json' } }, options.timeoutMs);
  const text = await upstream.text().catch(() => '');
  if (upstream.status === 404) return null;
  if (!upstream.ok) return null;

  const json = safeJson(text);
  const items = unwrapRegionalFeedItems(json ?? []);
  if (!items.length) return json;
  const filteredItems = filterByStateDistrict(items, options.stateSlug, options.districtSlug);
  return setPayloadItems(json, filteredItems);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const stateRaw = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
  const state = String(stateRaw || '').trim();
  if (!state) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'STATE_REQUIRED' });
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

  const sanitized = sanitizeRegionalQuery(qs, { state, lang: requestedLang });
  const targetUrl = `${base}/api/public/regional/${encodeURIComponent(state)}${sanitized.qs}`;

  const stateSlug = normalizeGeoToken(state);
  const districtSlugRaw = normalizeGeoToken(
    asSingleQueryValue(req.query.districtSlug) || asSingleQueryValue(req.query.district)
  );
  const districtSlug = isInvalidOptionalToken(districtSlugRaw) ? '' : districtSlugRaw;

  try {
    const upstream = await fetchWithTimeout(
      targetUrl,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'cache-control': 'no-store',
          cookie: String(req.headers.cookie || ''),
          authorization: String(req.headers.authorization || ''),
        },
      },
      Number(process.env.PUBLIC_REGIONAL_UPSTREAM_TIMEOUT_MS || 10000)
    );

    const text = await upstream.text().catch(() => '');

    try {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      if (!upstream.ok) {
        return res.status(upstream.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status });
      }

      const json = safeJson(text) ?? [];
      const deduped = dedupeRegionalFeedPayload(json, requestedLang);
      const filtered = filterRegionalFeedPayload(deduped, shouldKeepRegionalItem);

      if (!unwrapRegionalFeedItems(filtered).length) {
        const fallback = await fetchRegionalFallbackFromStories({
          base,
          qs: sanitized.qs,
          requestedLang,
          stateSlug,
          districtSlug,
          timeoutMs: Number(process.env.PUBLIC_REGIONAL_UPSTREAM_TIMEOUT_MS || 10000),
        });
        if (fallback) {
          const dedupedFallback = dedupeRegionalFeedPayload(fallback ?? [], requestedLang);
          const filteredFallback = filterRegionalFeedPayload(dedupedFallback, shouldKeepRegionalItem);
          return res.status(200).json(filteredFallback);
        }
      }

      return res.status(200).json(filtered);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ ok: false, message: 'INVALID_UPSTREAM_JSON' });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(502).json({ ok: false, message: 'UPSTREAM_FETCH_FAILED' });
  }
}
