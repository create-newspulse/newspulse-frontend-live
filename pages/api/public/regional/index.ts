import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { fetchRegionalFeedSource } from '../../../../lib/regionalFeedSource';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Prevent edge/browser caching; regional feeds must reflect deletes/unpublishes quickly.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const result = await fetchRegionalFeedSource({
    base,
    url: req.url,
    query: req.query,
    headers: req.headers,
  });
  return res.status(result.status).json(result.payload);
}
