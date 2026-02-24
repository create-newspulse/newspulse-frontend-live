import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

function safeJsonParse(raw: string): any {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeTranslateBody(body: unknown): string {
  const asObj = (() => {
    if (typeof body === 'string') return safeJsonParse(body) ?? {};
    if (body && typeof body === 'object') return body as any;
    return {};
  })();

  const lang = String((asObj as any)?.lang || (asObj as any)?.language || (asObj as any)?.targetLang || '').toLowerCase().trim();

  // Backend compatibility: support both `lang` and `language`.
  const out: Record<string, any> = { ...(asObj as any) };
  if (lang) {
    if (!out.lang) out.lang = lang;
    if (!out.language) out.language = lang;
  }

  return JSON.stringify(out);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }

  const id = String(req.query.id || '').trim();
  if (!id) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'MISSING_ID' });
  }

  try {
    const body = normalizeTranslateBody(req.body);

    const upstream = await fetch(`${base}/api/public/news/${encodeURIComponent(id)}/translate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
      body,
    });

    const text = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      // Never bubble upstream failures as 5xx to the browser.
      // This keeps UI flows stable even if the backend translation service is down.
      const upstreamJson = safeJsonParse(text);
      const upstreamMsg = upstreamJson && typeof upstreamJson === 'object' ? String((upstreamJson as any).message || (upstreamJson as any).error || '') : '';
      return res.status(200).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status, upstreamMessage: upstreamMsg || undefined });
    }

    try {
      const json = text ? JSON.parse(text) : {};
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('translate proxy error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: false, message: 'NETWORK_ERROR' });
  }
}
