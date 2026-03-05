import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { dedupeRegionalFeedPayload, filterRegionalFeedPayload } from '../../../../lib/unwrapRegionalFeed';

const BLOCKED_SLUGS = new Set<string>([
  'final-result-of-unarmed-psi-recruitment-announced-472-candidates-will-become-keeper-of-khaki',
]);

const BLOCKED_IDS = new Set<string>([
  '69a9d5f74c3cb9a18ef5a179',
  '69a9ca4a4c3cb9a18ef5a16f',
]);

function shouldKeepRegionalItem(item: any): boolean {
  const id = String(item?._id || item?.id || '').trim();
  if (id && BLOCKED_IDS.has(id)) return false;

  const slug = String(item?.slug || '').trim();
  if (slug && BLOCKED_SLUGS.has(slug)) return false;

  const slugs = item?.slugs;
  if (slugs && typeof slugs === 'object') {
    for (const v of Object.values(slugs)) {
      const s = String(v || '').trim();
      if (s && BLOCKED_SLUGS.has(s)) return false;
    }
  }

  return true;
}

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
  if (!state) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'STATE_REQUIRED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/regional/${encodeURIComponent(state)}${qs}`;

  const langRaw = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
  const languageRaw = Array.isArray(req.query.language) ? req.query.language[0] : req.query.language;
  const requestedLang = String(langRaw || languageRaw || '').trim();

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

    try {
      res.setHeader('Cache-Control', 'no-store');
      if (!upstream.ok) {
        return res.status(upstream.status).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status });
      }

      const json = text ? JSON.parse(text) : [];
      const deduped = dedupeRegionalFeedPayload(json, requestedLang);
      const filtered = filterRegionalFeedPayload(deduped, shouldKeepRegionalItem);
      return res.status(200).json(filtered);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ ok: false, message: 'INVALID_UPSTREAM_JSON' });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, message: 'UPSTREAM_FETCH_FAILED' });
  }
}
