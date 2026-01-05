import type { NextApiRequest, NextApiResponse } from 'next';

type SlotName = 'HOME_728x90' | 'HOME_RIGHT_300x250';

export type PublicAdSettingsResponse = {
  ok: boolean;
  slotEnabled: Record<SlotName, boolean>;
};

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const TTL_MS = 60_000;

const DEFAULT_SETTINGS: PublicAdSettingsResponse = {
  ok: true,
  slotEnabled: {
    HOME_728x90: true,
    HOME_RIGHT_300x250: true,
  },
};

let cached: { fetchedAt: number; data: PublicAdSettingsResponse } | null = null;

function sanitize(upstream: any): PublicAdSettingsResponse {
  const s = upstream && typeof upstream === 'object' ? upstream : null;
  const slotEnabledRaw = s?.slotEnabled && typeof s.slotEnabled === 'object' ? s.slotEnabled : {};

  return {
    ok: s?.ok === true,
    slotEnabled: {
      HOME_728x90: slotEnabledRaw?.HOME_728x90 !== false,
      HOME_RIGHT_300x250: slotEnabledRaw?.HOME_RIGHT_300x250 !== false,
    },
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

  if (!BACKEND_URL) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(DEFAULT_SETTINGS);
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/public/ad-settings`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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

    const data = upstream.ok && json ? sanitize(json) : DEFAULT_SETTINGS;
    cached = { fetchedAt: now, data };

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(data);
  } catch {
    // Fail open: if backend unreachable, keep slots enabled.
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(DEFAULT_SETTINGS);
  }
}
