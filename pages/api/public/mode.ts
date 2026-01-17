import type { NextApiRequest, NextApiResponse } from 'next';

type PublicMode = 'NORMAL' | 'READONLY' | 'LOCKDOWN';

type PublicModeResponse = {
  ok: boolean;
  mode: PublicMode;
  readOnly: boolean;
  externalFetch: boolean;
  message?: string;
};

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || '').toString().trim();
  return raw.replace(/\/+$/, '');
}
const TTL_MS = 60_000;

const DEFAULT_MODE: PublicModeResponse = {
  ok: true,
  mode: 'NORMAL',
  readOnly: false,
  externalFetch: true,
};

let cached: { fetchedAt: number; data: PublicModeResponse } | null = null;

function sanitize(upstream: any): PublicModeResponse {
  const mode: PublicMode = ['NORMAL', 'READONLY', 'LOCKDOWN'].includes(upstream?.mode) ? upstream.mode : 'NORMAL';
  return {
    ok: upstream?.ok === true,
    mode,
    readOnly: Boolean(upstream?.readOnly),
    externalFetch: upstream?.externalFetch !== false,
    message: typeof upstream?.message === 'string' ? upstream.message : undefined,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(cached.data);
  }

  try {
    const base = getApiBase();
    if (!base) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json(DEFAULT_MODE);
    }

    const upstream = await fetch(`${base}/api/system/public-mode`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await upstream.text().catch(() => '');
    const json = text ? (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })() : null;

    const data = upstream.ok && json ? sanitize(json) : DEFAULT_MODE;
    cached = { fetchedAt: now, data };

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(data);
  } catch {
    // Backend unreachable: fail open to NORMAL.
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(DEFAULT_MODE);
  }
}
