import type { NextApiRequest, NextApiResponse } from 'next';
import { PORTAL_PATH, reporterBackendFetch } from '../../../lib/reporterBackend.server';
import { apiMethod, hasLogoutReceipt, reporterJson, revokedReporterCookies, revocationRetryCookie } from '../../../lib/reporterAuthProxy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!apiMethod(req, res, 'POST')) return;
  // Never preflight /session: logout must revoke *all* presented credentials
  // even when the portal is closed or the primary credential has expired.
  try {
    const upstream = await reporterBackendFetch(req, `${PORTAL_PATH}/auth/logout`, { method: 'POST' });
    if (upstream.status === 200 && (await reporterJson(upstream)).ok === true && hasLogoutReceipt(upstream.headers, req)) {
      res.setHeader('Set-Cookie', revokedReporterCookies(req));
      return res.status(200).json({ ok: true, revoked: true });
    }
  } catch { /* Revocation is unconfirmed. Keep the credentials for retry. */ }
  res.setHeader('Set-Cookie', revocationRetryCookie(req));
  return res.status(503).json({ ok: false, revoked: false, code: 'LOGOUT_UNCONFIRMED' });
}
