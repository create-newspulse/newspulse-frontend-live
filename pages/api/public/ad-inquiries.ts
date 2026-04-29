import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

const CONTACT_EMAIL = 'newspulse.ads@gmail.com';

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function readJsonBody(req: NextApiRequest): Record<string, any> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, any>;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, any>;
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

export default async function publicAdInquiriesHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const body = readJsonBody(req);
  const payload = {
    name: asCleanString(body.name),
    email: asCleanString(body.email),
    phone: asCleanString(body.phone),
    company: asCleanString(body.company),
    slot: asCleanString(body.slot),
    slotLabel: asCleanString(body.slotLabel),
    budget: asCleanString(body.budget),
    target: asCleanString(body.target),
    startDate: asCleanString(body.startDate),
    message: asCleanString(body.message),
    pageUrl: asCleanString(body.pageUrl),
    contactEmail: CONTACT_EMAIL,
  };

  if (!payload.name || !isValidEmail(payload.email) || !payload.message) {
    return res.status(400).json({ ok: false, message: 'Invalid inquiry details' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/ad-inquiries`, {
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
      return res.status(upstream.status || 500).json({ ok: false, message: text || 'Upstream Error' });
    }

    return res.status(upstream.status || 200).json(json || { ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Internal Server Error' });
  }
}
