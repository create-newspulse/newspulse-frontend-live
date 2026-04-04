import type { NextApiRequest, NextApiResponse } from 'next';
import { createSessionCookie, createSessionToken, getMagicLinkFromToken } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const token = String(req.body?.token || '').trim();
  const payload = getMagicLinkFromToken(token);
  if (!payload) {
    return res.status(400).json({ ok: false, message: 'MAGIC_LINK_INVALID_OR_EXPIRED' });
  }

  const sessionToken = createSessionToken(payload.email);
  res.setHeader('Set-Cookie', createSessionCookie(sessionToken));
  return res.status(200).json({ ok: true, email: payload.email });
}