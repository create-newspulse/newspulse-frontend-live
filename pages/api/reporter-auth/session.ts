import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie, requireReporterSession } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const validation = await requireReporterSession(req, { route: '/api/reporter-auth/session' });
  if (!validation.ok) {
    if (validation.shouldClearCookie) {
      res.setHeader('Set-Cookie', clearSessionCookie());
    }
    return res.status(401).json({ ok: false, code: validation.code, message: validation.message });
  }

  const reporter = validation.reporter;
  return res.status(200).json({ ok: true, reporter, session: reporter });
}