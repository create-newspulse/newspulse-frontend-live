import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { getLocalizedArticleFields, normalizeRouteLocale, STRICT_LOCALE_POLICY } from '../../../../../lib/localizedArticleFields';
import { unwrapArticle } from '../../../../../lib/publicNewsApi';
import { pickFreshestArticleForLocale } from '../../../../../lib/translationGroupSync';

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

function getPayloadItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.articles)) return payload.articles;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.articles)) return payload.data.articles;
  return [];
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
  const targetUrl = `${base}/api/public/news/${encodeURIComponent(id)}${qs}`;

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
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }

    try {
      const json = text ? JSON.parse(text) : {};
      let article = unwrapArticle(json);
      const translationGroupId = String((article as any)?.translationGroupId || '').trim();

      if (article?._id && translationGroupId) {
        try {
          const groupUrl = `${base}/api/public/news/group/${encodeURIComponent(translationGroupId)}${qs}`;
          const groupRes = await fetch(groupUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              cookie: String(req.headers.cookie || ''),
              authorization: String(req.headers.authorization || ''),
            },
          });
          const groupText = await groupRes.text().catch(() => '');
          const groupJson = groupText ? JSON.parse(groupText) : { items: [] };
          const groupItems = groupRes.ok ? getPayloadItems(groupJson) : [];
          article = pickFreshestArticleForLocale({
            currentArticle: article,
            groupArticles: groupItems,
            locale: requestedLocale,
            policy: STRICT_LOCALE_POLICY,
          }) as any;
        } catch {
          // Keep the direct article if the group lookup is unavailable.
        }
      }

      const localized = getLocalizedArticleFields(article, requestedLocale, STRICT_LOCALE_POLICY);
      if (!localized.isVisible) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
      }

      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(article && article !== unwrapArticle(json) ? { ...json, article } : json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }
}
