import type { NextApiRequest, NextApiResponse } from 'next'

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase'

type CommunitySettingsPublic = {
  communityReporterEnabled: boolean;
  allowNewSubmissions: boolean;
  allowMyStoriesPortal: boolean;
  allowJournalistApplications: boolean;
};

type CommunitySettingsResponse = {
  ok: boolean;
  settings: CommunitySettingsPublic;
};

const DEFAULT_SETTINGS: CommunitySettingsResponse = {
  ok: true,
  settings: {
    communityReporterEnabled: true,
    allowNewSubmissions: true,
    allowMyStoriesPortal: true,
    allowJournalistApplications: true,
  },
};

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CommunitySettingsResponse | { error: string }>,
) {
  noStore(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const base = getPublicApiBaseUrl().trim().replace(/\/+$/, '')

    try {
      if (!base) {
        console.warn('[api/public/community/settings] public API base not set; using defaults')
      } else {
        const r = await fetch(`${base}/api/public/community/settings`, {
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        })
        if (r.ok) {
          const data = await r.json()
          if (data && data.ok === true && data.settings) {
            return res.status(200).json({
              ok: true,
              settings: {
                communityReporterEnabled: Boolean(data.settings.communityReporterEnabled),
                allowNewSubmissions: Boolean(data.settings.allowNewSubmissions),
                allowMyStoriesPortal: Boolean(data.settings.allowMyStoriesPortal),
                allowJournalistApplications: Boolean(data.settings.allowJournalistApplications),
              },
            })
          }
        } else {
          console.warn('[api/public/community/settings] backend status', r.status, r.statusText)
        }
      }
    } catch (err: any) {
      console.warn('[api/public/community/settings] backend fetch failed:', err?.message ?? err)
      // keep defaults, don't throw
    }

    return res.status(200).json(DEFAULT_SETTINGS)
  } catch (err) {
    console.error('[api/public/community/settings] error:', err)
    return res.status(200).json(DEFAULT_SETTINGS)
  }
}
