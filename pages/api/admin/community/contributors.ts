import type { NextApiRequest, NextApiResponse } from 'next';
import { setAdminProxyCors } from '../../../../lib/adminApiProxy';
import { reporterBackendOrigin, reporterIngressAvailable } from '../../../../lib/reporterBackend.server';
import { dispatchReporterOperation } from '../../../../lib/reporterRuntime.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setAdminProxyCors(req, res, ['GET']);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Allow', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  const unavailable = () => res.status(503).json({ ok: false, code: 'REPORTER_DIRECTORY_UNAVAILABLE' });
  if (!reporterIngressAvailable(req)) return unavailable();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!['page', 'limit', 'q', 'search', 'status', 'verification', 'reporterType', 'type', 'state', 'district', 'city', 'country', 'includeArchived'].includes(key)
      || typeof value !== 'string' || value.length > 256) return res.status(400).json({ ok: false, code: 'INVALID_QUERY' });
    query.set(key, value);
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  const cookie = req.headers.cookie?.split(';').map(pair => pair.trim()).filter(pair => /^(?:np_admin_token|np_token|token)=/.test(pair)).join('; ');
  if (cookie) headers.cookie = cookie;
  try {
    const upstream = await dispatchReporterOperation(reporterBackendOrigin(req), '/admin/community/contributors' + (query.size ? `?${query}` : ''), { method: 'GET', headers });
    if (!upstream.ok) return res.status(upstream.status).json({ ok: false, code: 'REPORTER_DIRECTORY_DENIED' });
    return res.status(200).json(await upstream.json());
  } catch {
    return unavailable();
  }
}