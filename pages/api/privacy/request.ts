import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

const ALLOWED_REQUEST_TYPES = new Set([
  'access',
  'correction',
  'deletion',
  'withdraw_consent',
  'grievance',
  'other',
]);

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function readJsonBody(req: NextApiRequest): Record<string, unknown> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function asCleanString(value: unknown): string {
  return String(value || '').trim().replace(/\r\n/g, '\n');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function privacyRequestHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const body = readJsonBody(req);
  const requestType = asCleanString(body.requestType || body.type);
  const payload = {
    fullName: asCleanString(body.fullName),
    email: asCleanString(body.email),
    mobile: asCleanString(body.mobile || body.phone),
    requestType,
    type: requestType,
    message: asCleanString(body.message),
    referenceId: asCleanString(body.referenceId),
    pageUrl: asCleanString(body.pageUrl),
  };

  if (!payload.fullName || !isValidEmail(payload.email) || !ALLOWED_REQUEST_TYPES.has(payload.requestType) || !payload.message) {
    return res.status(400).json({ ok: false, message: 'Invalid privacy request details' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' });
  }

  try {
    const upstream = await fetch(`${origin}/api/privacy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text().catch(() => '');
    const json = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : null;

    if (!upstream.ok || json?.ok === false) {
      return res.status(upstream.status || 500).json({ ok: false, message: 'Unable to submit privacy request' });
    }

    return res.status(upstream.status || 200).json(json || { ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Unable to submit privacy request' });
  }
}