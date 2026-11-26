import type { NextApiRequest, NextApiResponse } from 'next';
import { publicReporterBackendFetch } from '../../../lib/reporterBackend.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }
  const unavailable = () => res.status(503).json({ ok: false, code: 'COMMUNITY_SETTINGS_UNAVAILABLE' });
  try {
    const upstream = await publicReporterBackendFetch(req, '/api/community-reporter/config');
    if (!upstream.ok) return unavailable();
    const data = await upstream.json();
    if (data?.ok !== true) return unavailable();
    const { communityMyStoriesEnabled, communityReporterClosed, communityReporterEnabled, reporterPortalClosed, reporterPortalEnabled } = data;
    const flags = { communityMyStoriesEnabled, communityReporterClosed, communityReporterEnabled, reporterPortalClosed, reporterPortalEnabled };
    if (!Object.values(flags).every(flag => typeof flag === 'boolean')) return unavailable();
    return res.status(200).json({ ok: true, ...flags });
  } catch {
    return unavailable();
  }
}
