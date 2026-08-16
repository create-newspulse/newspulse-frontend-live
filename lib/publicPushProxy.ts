import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from './publicApiBase';
import { normalizeNewsPulsePushCategoryIds } from './pushNotificationPreferences';

type PushProxyMethod = 'POST' | 'PUT' | 'DELETE';
type PushReceiptEvent = 'received' | 'shown' | 'display_failed' | 'clicked';
const SUPPORTED_PUSH_PREFERENCE_KEYS = [
  'breakingNews',
  'topStories',
  'newArticleAlerts',
  'categoryAlerts',
  'allArticles',
] as const;

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
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

function cleanString(value: unknown): string {
  return String(value || '').trim();
}

function normalizeLanguage(value: unknown): 'en' | 'hi' | 'gu' {
  const lang = cleanString(value).toLowerCase();
  return lang === 'hi' || lang === 'gu' ? lang : 'en';
}

function normalizePushPreferences(value: unknown): Record<string, boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const preferences: Record<string, boolean> = {};
  SUPPORTED_PUSH_PREFERENCE_KEYS.forEach((key) => {
    if (typeof source[key] === 'boolean') preferences[key] = source[key];
  });
  return Object.keys(preferences).length ? preferences : undefined;
}

function buildSupportedPayload(body: Record<string, unknown>) {
  const token = cleanString(body.token || body.registrationId);
  const registrationType = cleanString(body.registrationType);
  const platform = cleanString(body.platform) || 'web';
  const preferences = normalizePushPreferences(body.preferences);
  const categories = normalizeNewsPulsePushCategoryIds(body.categories);

  return {
    token,
    registrationType,
    platform,
    language: normalizeLanguage(body.language),
    ...(preferences ? { preferences } : {}),
    categories,
  };
}

function methodAllowed(req: NextApiRequest, allowed: PushProxyMethod[]): boolean {
  return allowed.includes(req.method as PushProxyMethod);
}

export async function proxyPublicPushRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  path: '/api/public/push/register' | '/api/public/push/preferences' | '/api/public/push/unregister',
  allowed: PushProxyMethod[]
) {
  if (!methodAllowed(req, allowed)) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' });
  }

  const payload = buildSupportedPayload(readJsonBody(req));
  if (!payload.token || payload.registrationType !== 'token') {
    return res.status(400).json({ ok: false, message: 'Invalid push registration details' });
  }

  try {
    const upstream = await fetch(`${origin}${path}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
      return res.status(upstream.status || 500).json(json || { ok: false, message: text || 'Upstream Error' });
    }

    return res.status(upstream.status || 200).json(json || { ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Internal Server Error' });
  }
}

function normalizePushReceiptEvent(value: unknown): PushReceiptEvent | null {
  const event = cleanString(value).toLowerCase();
  return event === 'received' || event === 'shown' || event === 'display_failed' || event === 'clicked' ? event : null;
}

function buildSupportedReceiptPayload(body: Record<string, unknown>) {
  return {
    deliveryLogId: cleanString(body.deliveryLogId),
    event: normalizePushReceiptEvent(body.event),
  };
}

export async function proxyPublicPushReceiptRequest(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' });
  }

  const payload = buildSupportedReceiptPayload(readJsonBody(req));
  if (!payload.deliveryLogId || !payload.event) {
    return res.status(400).json({ ok: false, message: 'Invalid push receipt details' });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/push/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
      return res.status(upstream.status || 500).json(json || { ok: false, message: text || 'Upstream Error' });
    }

    return res.status(upstream.status || 200).json(json || { ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Internal Server Error' });
  }
}