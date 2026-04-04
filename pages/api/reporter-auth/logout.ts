import type { NextApiRequest, NextApiResponse } from 'next';
import { clearOtpCookie, clearSessionCookie } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  res.setHeader('Set-Cookie', [clearSessionCookie(), clearOtpCookie()]);
  return res.status(200).json({ ok: true });
}