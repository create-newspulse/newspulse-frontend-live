import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

function getApiBase(): string {
  // Prefer the shared base resolver (supports env separation + legacy aliases).
  // This runs server-side (API route), so it will not return same-origin.
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
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

  const base = getApiBase();
  if (!base) return res.status(200).json([]);

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/stories${qs}`;

  try {
    // IMPORTANT: avoid hanging the frontend when upstream is slow/unresponsive.
    // If we time out, we return an empty list to keep pages responsive.
    const upstream = await fetchWithTimeout(
      targetUrl,
      { method: 'GET', headers: { Accept: 'application/json' } },
      Number(process.env.PUBLIC_STORIES_UPSTREAM_TIMEOUT_MS || 10000)
    );
    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404) return res.status(200).json([]);
    if (!upstream.ok) return res.status(200).json([]);

    try {
      const json = text ? JSON.parse(text) : [];
      return res.status(200).json(json);
    } catch {
      return res.status(200).json([]);
    }
  } catch {
    return res.status(200).json([]);
  }
}
