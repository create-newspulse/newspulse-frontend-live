import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { getLocalizedArticleFields, getLocalizedSlug, normalizeRouteLocale, STRICT_LOCALE_POLICY, type RouteLocale } from '../../../../../lib/localizedArticleFields';
import { failedPublicNewsPayload, isLegacyMissingArticle, isResolvedPublicArticleForLocale, parsePublicNewsArticle, parsePublicNewsGroupItems, parsePublicNewsList, type Article } from '../../../../../lib/publicNewsApi';
import { pickFreshestArticleForLocale } from '../../../../../lib/translationGroupSync';
import { isPulseDialogueArticle } from '../../../../../lib/pulseDialogue';
import { withPublicReadDeadline } from '../../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../../lib/retryAfter';
import { withArticleSocialImage } from '../../../../../lib/articleSocialImage.server';
import { readWithPreviewDiagnostics, startBackendPreviewDiagnostics } from '../../../../../lib/socialPreviewDiagnostics.server';

type ReadPublicJson = (url: string, timeoutMs?: number) => Promise<{ status: number; payload: unknown }>;

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

function getArticleSlugCandidates(article: Record<string, unknown>, requestedLocale: RouteLocale): string[] {
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

function pendingTranslationResponse(payload: unknown): { status: 'pending' | 'translating'; sourceLang?: RouteLocale } | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || failedPublicNewsPayload(payload)) return null;
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown> : null;
  if (failedPublicNewsPayload(nested)) return null;
  const directStatus = String(record.status || record.translationStatus || record.state || '').toLowerCase();
  const status = directStatus === 'pending' || directStatus === 'translating'
    ? directStatus
    : String(nested?.status || nested?.translationStatus || nested?.state || '').toLowerCase();
  if (status !== 'pending' && status !== 'translating') return null;
  const sourceLang = [
    record.sourceLang, record.sourceLanguage, record.availableLang, record.availableLanguage,
    nested?.sourceLang, nested?.sourceLanguage, nested?.availableLang, nested?.availableLanguage,
  ].find((value) => typeof value === 'string' && ['en', 'hi', 'gu'].includes(value.trim().toLowerCase()));
  return { status, ...(typeof sourceLang === 'string' ? { sourceLang: normalizeRouteLocale(sourceLang) } : {}) };
}

async function resolveArticleFromTranslationGroup(options: {
  base: string;
  qs: string;
  readJson: ReadPublicJson;
  article: Article;
  requestedLocale: RouteLocale;
}): Promise<Article | null> {
  // A raw group row must not replace the Backend's resolved edition or collision-safe ID route.
  if (isResolvedPublicArticleForLocale(options.article, options.requestedLocale)) return options.article;
  const translationGroupId = String(options.article?.translationGroupId || '').trim();
  if (!options.article?._id || !translationGroupId) return options.article;

  try {
    const groupUrl = `${options.base}/api/public/news/group/${encodeURIComponent(translationGroupId)}${options.qs}`;
    const groupRes = await options.readJson(groupUrl, 1500);
    if (groupRes.status < 200 || groupRes.status >= 300) throw new Error('PUBLIC_NEWS_GROUP_UNAVAILABLE');
    const groupItems = parsePublicNewsGroupItems(groupRes.payload);
    if (!groupItems) throw new Error('INVALID_PUBLIC_NEWS_GROUP');
    return pickFreshestArticleForLocale({
      currentArticle: options.article,
      groupArticles: groupItems,
      locale: options.requestedLocale,
      policy: STRICT_LOCALE_POLICY,
    });
  } catch {
    if (process.env.NODE_ENV !== 'production') console.error('[api/public/news/slug] translation_group_unavailable');
    const localized = getLocalizedArticleFields(options.article, options.requestedLocale, STRICT_LOCALE_POLICY);
    if (localized.status === 'published' && !localized.isVisible) throw new Error('PUBLIC_NEWS_GROUP_UNAVAILABLE');
    return options.article;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const requestedLocale = normalizeRouteLocale(
    asSingleQueryValue(req.query.language) || asSingleQueryValue(req.query.lang)
  );
  const diagnostics = startBackendPreviewDiagnostics(req, res, requestedLocale);
  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(400).json({ ok: false, message: 'MISSING_SLUG' });

  const base = getApiBase();
  if (!base) {
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';

  // Backend contract: /api/public/news/slug/:slug?lang=...
  const targetUrl = `${base}/api/public/news/slug/${encodeURIComponent(slug)}${qs}`;

  const normalizedRequestedSlug = normalizeSlugValue(slug);

  const requestHeaders = {
    Accept: 'application/json',
    cookie: String(req.headers.cookie || ''),
    authorization: String(req.headers.authorization || ''),
  };

  const deadlineAt = Date.now() + 4000;
  let retryAfter: string | undefined;
  const readJson: ReadPublicJson = async (url, timeoutMs = 4000) => {
    const remaining = Math.min(timeoutMs, deadlineAt - Date.now());
    if (remaining <= 0) {
      diagnostics?.fail('timeout');
      throw new Error('PUBLIC_NEWS_UNAVAILABLE');
    }
    return readWithPreviewDiagnostics(diagnostics, recordStatus => withPublicReadDeadline(remaining, async (signal) => {
      const upstream = await fetch(url, { method: 'GET', headers: requestHeaders, cache: 'no-store', signal });
      recordStatus(upstream.status);
      retryAfter = getSafeRetryAfter(upstream.headers?.get('Retry-After'));
      const payload: unknown = upstream.ok ? JSON.parse(await upstream.text()) : null;
      signal.throwIfAborted();
      return { status: upstream.status, payload };
    }));
  };
  const unavailable = (status = 503) => {
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    return res.status(status >= 400 && status < 600 ? status : 503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  };
  const notFound = (status = 404) => res.status(status).json({ ok: false, message: 'NOT_FOUND' });
  const returnResolvedArticle = async (article: Article, stage: string) => {
    const localized = getLocalizedArticleFields(article, requestedLocale, STRICT_LOCALE_POLICY);
    if (!localized.isVisible) return notFound();
    debugSlugResolution(stage, {
      locale: requestedLocale,
      receivedSlug: normalizedRequestedSlug,
      resolvedSlug: localized.slug || normalizedRequestedSlug,
      articleId: article._id,
      translationFound: localized.translationFound,
    });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ article: await withArticleSocialImage(article, requestedLocale, deadlineAt - Date.now(), diagnostics?.imageFailure) });
  };

  try {
    const upstream = await readJson(targetUrl);
    if (upstream.status === 404 || upstream.status === 410) return notFound(upstream.status);
    if (upstream.status < 200 || upstream.status >= 300) return unavailable(upstream.status);
    const json = upstream.payload;
    if (isLegacyMissingArticle(json)) return res.status(200).json({ exists: false });
    if (failedPublicNewsPayload(json) || (json && typeof json === 'object' && 'exists' in json && json.exists === false)) {
      throw new Error('INVALID_PUBLIC_NEWS_ARTICLE');
    }
    const pending = pendingTranslationResponse(json);
    if (pending) return res.status(200).json(pending);

    const article = parsePublicNewsArticle(json);
    if (article) {
      if (getLocalizedArticleFields(article, requestedLocale, STRICT_LOCALE_POLICY).status !== 'published') return notFound();
      let resolvedArticle = await resolveArticleFromTranslationGroup({ base, qs, readJson, article, requestedLocale });
      if (!resolvedArticle) return notFound();
      if (isPulseDialogueArticle(resolvedArticle)) {
        const detail = await readJson(`${base}/api/public/news/${encodeURIComponent(resolvedArticle._id)}${qs}`, 1500);
        if (detail.status === 404 || detail.status === 410) return notFound(detail.status);
        if (detail.status < 200 || detail.status >= 300) return unavailable(detail.status);
        if (isLegacyMissingArticle(detail.payload)) return res.status(200).json({ exists: false });
        const detailArticle = parsePublicNewsArticle(detail.payload);
        if (!detailArticle) throw new Error('INVALID_PUBLIC_NEWS_ARTICLE');
        const detailLocale = getLocalizedArticleFields(detailArticle, requestedLocale, STRICT_LOCALE_POLICY);
        if (detailLocale.status !== 'published') return notFound();
        const detailLanguage = detailArticle.language || ('lang' in detailArticle ? detailArticle.lang : '');
        if (detailArticle._id !== resolvedArticle._id || typeof detailLanguage !== 'string' || !detailLanguage.trim() ||
          normalizeRouteLocale(detailLanguage) !== requestedLocale || !isPulseDialogueArticle(detailArticle) || !detailLocale.isVisible) {
          throw new Error('PULSE_DIALOGUE_DETAIL_MISMATCH');
        }
        resolvedArticle = detailArticle;
      }
      return await returnResolvedArticle(resolvedArticle, resolvedArticle === article ? 'direct-hit' : 'direct-group-hit');
    }

    // Only the established legacy null response permits listing-based ID discovery.
    if (!json || typeof json !== 'object' || Array.isArray(json) || !('article' in json) || json.article !== null) {
      throw new Error('INVALID_PUBLIC_NEWS_ARTICLE');
    }
    const listParams = new URLSearchParams(qsIndex >= 0 ? (req.url || '').slice(qsIndex + 1) : '');
    const currentLimit = Number(listParams.get('limit') || 0);
    if (!Number.isFinite(currentLimit) || currentLimit < 200) listParams.set('limit', '200');
    listParams.set('strictLocale', '1');

    const list = await readJson(`${base}/api/public/news?${listParams.toString()}`);
    if (list.status < 200 || list.status >= 300) {
      return unavailable(list.status === 404 || list.status === 410 ? 503 : list.status);
    }
    const parsedList = parsePublicNewsList(list.payload);
    if (!parsedList) throw new Error('INVALID_PUBLIC_NEWS_LIST');
    const matched = parsedList.items.find((item) => getArticleSlugCandidates(item, requestedLocale).includes(normalizedRequestedSlug));
    if (!matched) return res.status(200).json({ article: null });

    const detail = await readJson(`${base}/api/public/news/${encodeURIComponent(matched._id)}${qs}`);
    if (detail.status === 404 || detail.status === 410) return notFound(detail.status);
    if (detail.status < 200 || detail.status >= 300) return unavailable(detail.status);
    if (isLegacyMissingArticle(detail.payload)) return res.status(200).json({ exists: false });
    const detailArticle = parsePublicNewsArticle(detail.payload);
    if (!detailArticle) throw new Error('INVALID_PUBLIC_NEWS_ARTICLE');
    return await returnResolvedArticle(detailArticle, 'fallback-by-id');
  } catch {
    return unavailable();
  }
}
