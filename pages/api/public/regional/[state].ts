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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const stateRaw = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
  const state = String(stateRaw || '').trim();
  if (!state) return res.status(200).json([]);

  const base = getApiBase();
  if (!base) return res.status(200).json([]);

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/regional/${encodeURIComponent(state)}${qs}`;

  try {
    const upstream = await fetchWithTimeout(
      targetUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          cookie: String(req.headers.cookie || ''),
          authorization: String(req.headers.authorization || ''),
        },
      },
      Number(process.env.PUBLIC_REGIONAL_UPSTREAM_TIMEOUT_MS || 10000)
    );

    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json([]);
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json([]);
    }

    try {
      const json = text ? JSON.parse(text) : [];
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json([]);
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json([]);
  }
}
