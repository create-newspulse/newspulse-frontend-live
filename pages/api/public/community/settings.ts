import type { NextApiRequest, NextApiResponse } from 'next';
import { publicReporterBackendFetch, reporterIngressAvailable } from '../../../../lib/reporterBackend.server';
import type { CommunitySettingsPublic } from '../../../../types/community-reporter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }
  const unavailable = () => res.status(503).json({ ok: false, code: 'COMMUNITY_SETTINGS_UNAVAILABLE', settings: {
    communityReporterEnabled: false, allowMyStoriesPortal: false, allowNewSubmissions: false, allowJournalistApplications: false,
  } });
  if (!reporterIngressAvailable(req)) return unavailable();
  try {
    const response = await publicReporterBackendFetch(req, '/api/public/community/settings');
    if (!response.ok) return unavailable();
    const data = await response.json();
    if (data?.ok !== true || !data.settings) return unavailable();
    const { communityReporterEnabled, allowMyStoriesPortal, allowNewSubmissions, allowJournalistApplications, communityReporterClosed, reporterPortalClosed } = data.settings;
    if (![communityReporterEnabled, allowMyStoriesPortal, allowNewSubmissions, allowJournalistApplications, communityReporterClosed, reporterPortalClosed].every(flag => typeof flag === 'boolean')) return unavailable();
    const settings: CommunitySettingsPublic = { communityReporterEnabled: communityReporterEnabled && !communityReporterClosed,
      allowMyStoriesPortal: communityReporterEnabled && !reporterPortalClosed && allowMyStoriesPortal,
      allowNewSubmissions: communityReporterEnabled && !communityReporterClosed && allowNewSubmissions, allowJournalistApplications };
    return res.status(200).json({ ok: true, settings });
  } catch {
    return unavailable();
  }
}
