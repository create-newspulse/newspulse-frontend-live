import type { NextApiRequest, NextApiResponse } from 'next';
import { apiMethod, expireLegacyReporterCookies } from '../../../lib/reporterAuthProxy';
import { requireReporterSession } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!apiMethod(req, res, 'GET')) return;
  expireLegacyReporterCookies(req, res);
  const validation = await requireReporterSession(req);
  if (!validation.ok) return res.status(validation.status).json({ ok: false, code: validation.reason });
  return res.status(200).json({ ok: true, authenticated: true, session: validation.reporter });
}
