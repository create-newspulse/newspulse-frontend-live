import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import { parsePublicNewsGroupItems } from '../../../../../lib/publicNewsApi';
import { withPublicReadDeadline } from '../../../../../lib/publicReadDeadline';
import { getSafeRetryAfter } from '../../../../../lib/retryAfter';

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
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          cookie: String(req.headers.cookie || ''),
          authorization: String(req.headers.authorization || ''),
        },
        cache: 'no-store',
        signal,
      });
      retryAfter = getSafeRetryAfter(upstream.headers?.get('Retry-After'));
      if (upstream.status === 404 || upstream.status === 410) return { items: [] };
      if (!upstream.ok) throw new Error('PUBLIC_NEWS_UNAVAILABLE');
      const payload: unknown = JSON.parse(await upstream.text());
      const items = parsePublicNewsGroupItems(payload);
      if (items === null) throw new Error('INVALID_PUBLIC_NEWS_GROUP');
      return { items };
    });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(json);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    return res.status(503).json({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  }
}
