import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { anonymousArticleGet } from '../../../../../lib/publicArticleRequest';
import { parsePublicNewsGroupItems } from '../../../../../lib/publicNewsApi';
import { withPublicReadDeadline } from '../../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../../lib/retryAfter';
import { normalizeRouteLocale } from '../../../../../lib/localizedArticleFields';
import { withArticleSocialImage } from '../../../../../lib/articleSocialImage.server';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const deadlineAt = performance.now() + 4000;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }

  const groupId = String(req.query.groupId || '').trim();
  if (!groupId) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'MISSING_GROUP_ID' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/news/group/${encodeURIComponent(groupId)}${qs}`;
  let retryAfter: string | undefined;

  try {
    const json = await withPublicReadDeadline(4000, async (signal) => {
      const upstream = await fetch(targetUrl, anonymousArticleGet(signal));
      retryAfter = getSafeRetryAfter(upstream.headers?.get('Retry-After'));
      if (!upstream.ok) throw new Error('PUBLIC_NEWS_UNAVAILABLE');
      const payload: unknown = JSON.parse(await upstream.text());
      const items = parsePublicNewsGroupItems(payload);
      if (items === null) throw new Error('INVALID_PUBLIC_NEWS_GROUP');
      return { items };
    });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const localeValue = req.query.language || req.query.lang;
    const locale = normalizeRouteLocale(Array.isArray(localeValue) ? localeValue[0] : localeValue);
    const items = await Promise.all(json.items.map(article => withArticleSocialImage(article, locale, deadlineAt - performance.now())));
    return res.status(200).json({ items });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }
}
