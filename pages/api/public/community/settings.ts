import type { NextApiRequest, NextApiResponse } from 'next'

type CommunitySettings = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
  updatedAt: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CommunitySettings | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const base = process.env.NEXT_PUBLIC_API_BASE

    // Default: everything open
    let toggles: CommunitySettings = {
      communityReporterClosed: false,
      reporterPortalClosed: false,
      updatedAt: null,
    }

    try {
      if (!base) {
        console.warn('[api/public/community/settings] NEXT_PUBLIC_API_BASE not set; using defaults')
      } else {
        const r = await fetch(`${base.replace(/\/+$/, '')}/api/public/feature-toggles`, { cache: 'no-store' })
        if (r.ok) {
          const data = await r.json()
          const s = (data && (data.settings ?? null)) || data
          toggles = {
            communityReporterClosed: !!s.communityReporterClosed,
            reporterPortalClosed: !!s.reporterPortalClosed,
            updatedAt: s.updatedAt ?? null,
          }
        } else {
          console.warn('[api/public/community/settings] backend status', r.status, r.statusText)
        }
      }
    } catch (err: any) {
      console.warn('[api/public/community/settings] backend fetch failed:', err?.message ?? err)
      // keep defaults, don't throw
    }

    // Always return 200 with a safe JSON payload
    return res.status(200).json(toggles)
  } catch (err) {
    console.error('[api/public/community/settings] error:', err)
    return res.status(200).json({
      communityReporterClosed: false,
      reporterPortalClosed: false,
      updatedAt: null,
    })
  }
}
