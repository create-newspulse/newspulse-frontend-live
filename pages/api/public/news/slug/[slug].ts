import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { getLocalizedArticleFields, getLocalizedSlug, normalizeRouteLocale, type RouteLocale } from '../../../../../lib/localizedArticleFields';
import { unwrapArticle, unwrapArticles } from '../../../../../lib/publicNewsApi';

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

function normalizeSlugValue(value: unknown): string {
  return String(value || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function debugSlugResolution(stage: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[api/public/news/slug]', { stage, ...payload });
}

function getArticleSlugCandidates(article: any, requestedLocale: RouteLocale): string[] {
  const values = [
    getLocalizedSlug(article, requestedLocale),
    getLocalizedSlug(article, 'en'),
    getLocalizedSlug(article, 'hi'),
    getLocalizedSlug(article, 'gu'),
    article?.slug,
    article?.seoSlug,
    article?.originalSlug,
    article?.sourceSlug,
    article?.baseSlug,
    article?.canonicalSlug,
  ];

  return values
    .map((value) => normalizeSlugValue(value))
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
}

function getItemsFromPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.articles)) return payload.articles;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.articles)) return payload.data.articles;
  return unwrapArticles(payload);
}

function isPendingTranslationPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const direct = String((payload as any).status || (payload as any).translationStatus || (payload as any).state || '').toLowerCase();
  if (direct === 'pending' || direct === 'translating') return true;

  const nested = (payload as any).data && typeof (payload as any).data === 'object' ? (payload as any).data : null;
  if (!nested) return false;

  const nestedStatus = String((nested as any).status || (nested as any).translationStatus || (nested as any).state || '').toLowerCase();
  return nestedStatus === 'pending' || nestedStatus === 'translating';
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
  const normalizedRequestedSlug = normalizeSlugValue(slug);

  const requestHeaders = {
    Accept: 'application/json',
    cookie: String(req.headers.cookie || ''),
    authorization: String(req.headers.authorization || ''),
  };

  const returnResolvedArticle = (json: any, article: any, stage: string) => {
    const localized = getLocalizedArticleFields(article, requestedLocale);
    debugSlugResolution(stage, {
      locale: requestedLocale,
      receivedSlug: normalizedRequestedSlug,
      resolvedSlug: localized.slug || normalizedRequestedSlug,
      articleId: String(article?._id || article?.id || '').trim() || null,
      translationFound: localized.translationFound,
    });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(json);
  };

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: requestHeaders,
    });

    const text = await upstream.text().catch(() => '');

    try {
      const json = text ? JSON.parse(text) : { article: null };
      if (isPendingTranslationPayload(json)) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json(json);
      }

      const article = unwrapArticle(json);
      const localized = getLocalizedArticleFields(article, requestedLocale);
      if (article?._id && localized.isVisible) {
        return returnResolvedArticle(json, article, 'direct-hit');
      }

      const listParams = new URLSearchParams(qsIndex >= 0 ? (req.url || '').slice(qsIndex + 1) : '');
      const currentLimit = Number(listParams.get('limit') || 0);
      if (!Number.isFinite(currentLimit) || currentLimit < 200) listParams.set('limit', '200');

      const listUrl = `${base}/api/public/news?${listParams.toString() ? `?${listParams.toString()}` : ''}`;
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: requestHeaders,
      });
      const listText = await listRes.text().catch(() => '');
      const listJson = listText ? JSON.parse(listText) : { items: [] };
      const listItems = getItemsFromPayload(listJson);

      const matched = listItems.find((item) => getArticleSlugCandidates(item, requestedLocale).includes(normalizedRequestedSlug));
      if (!matched) {
        debugSlugResolution('fallback-miss', {
          locale: requestedLocale,
          receivedSlug: normalizedRequestedSlug,
          resolvedSlug: null,
          articleId: null,
          translationFound: false,
        });
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({ article: null });
      }

      const matchedId = String(matched?._id || matched?.id || '').trim();
      if (!matchedId) {
        return returnResolvedArticle({ article: matched }, matched, 'fallback-list-only');
      }

      const detailUrl = `${base}/api/public/news/${encodeURIComponent(matchedId)}${qs}`;
      const detailRes = await fetch(detailUrl, {
        method: 'GET',
        headers: requestHeaders,
      });
      const detailText = await detailRes.text().catch(() => '');
      const detailJson = detailText ? JSON.parse(detailText) : { article: matched };
      const detailArticle = unwrapArticle(detailJson) || matched;

      return returnResolvedArticle(detailJson.article ? detailJson : { article: detailArticle }, detailArticle, 'fallback-by-id');
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ article: null });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ article: null });
  }
}
