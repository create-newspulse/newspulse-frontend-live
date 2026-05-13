import type { NextApiRequest, NextApiResponse } from 'next';

import { DEFAULT_PUBLIC_COMPLIANCE_SETTINGS } from '../../../lib/publicComplianceSettings';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

async function readJson(upstream: Response): Promise<any> {
  const text = await upstream.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getFallbackPayload() {
  return {
    ok: true,
    item: DEFAULT_PUBLIC_COMPLIANCE_SETTINGS,
    fallback: true,
  };
}

function setNoCacheHeaders(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default async function publicComplianceSettingsHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));

  if (!origin) {
    setNoCacheHeaders(res);
    return res.status(200).json(getFallbackPayload());
  }

  try {
    const upstream = await fetch(`${origin}/api/public/compliance-settings`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const json = await readJson(upstream);

    setNoCacheHeaders(res);
    if (!upstream.ok || !json) {
      return res.status(200).json(getFallbackPayload());
    }

    return res.status(200).json(json);
  } catch {
    setNoCacheHeaders(res);
    return res.status(200).json(getFallbackPayload());
  }
}