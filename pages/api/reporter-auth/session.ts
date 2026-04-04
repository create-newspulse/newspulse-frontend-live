import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie, getSessionFromCookie } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const token = String(req.cookies?.np_reporter_portal_session || '');
  const session = getSessionFromCookie(token);
  if (!session) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(401).json({ ok: false, message: 'SESSION_EXPIRED' });
  }

  return res.status(200).json({ ok: true, session: { email: session.email, expiresAt: new Date(session.exp).toISOString() } });
}