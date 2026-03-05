import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '')
    .trim()
    .replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function safeJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';

  const upstreamInit: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  };

  const timeoutMs = Number(process.env.PUBLIC_REGIONAL_UPSTREAM_TIMEOUT_MS || 10000);

  // Preferred upstream endpoint (query-string based): /api/public/regional?state=...
  const primaryUrl = `${base}/api/public/regional${qs}`;

  try {
    const upstream = await fetchWithTimeout(primaryUrl, upstreamInit, timeoutMs);
    const text = await upstream.text().catch(() => '');

    // Backward compatibility: some deployments used /api/public/regional/:state
    // If the query endpoint 404s but we have a state param, try the legacy path endpoint.
    if (upstream.status === 404) {
      const stateRaw = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
      const state = String(stateRaw || '').trim();
      if (state) {
        const legacyUrl = `${base}/api/public/regional/${encodeURIComponent(state)}${qs}`;
        const legacy = await fetchWithTimeout(legacyUrl, upstreamInit, timeoutMs);
        const legacyText = await legacy.text().catch(() => '');

        res.setHeader('Cache-Control', 'no-store');
        if (!legacy.ok) {
          return res.status(legacy.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: legacy.status });
        }

        const legacyJson = safeJson(legacyText);
        return res.status(200).json(legacyJson ?? []);
      }
    }

    res.setHeader('Cache-Control', 'no-store');

    if (!upstream.ok) {
      return res.status(upstream.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status });
    }

    const json = safeJson(text);
    return res.status(200).json(json ?? []);
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    const msg = String(e?.name || '').includes('Abort') ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED';
    const status = msg === 'UPSTREAM_TIMEOUT' ? 504 : 502;
    return res.status(status).json({ ok: false, message: msg, status });
  }
}
