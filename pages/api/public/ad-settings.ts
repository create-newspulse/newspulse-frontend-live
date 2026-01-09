import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

type SlotName = 'HOME_728x90' | 'HOME_RIGHT_300x250';

export type PublicAdSettingsResponse = {
  ok: boolean;
  slotEnabled: Record<SlotName, boolean>;
};

const DEFAULT_SETTINGS: PublicAdSettingsResponse = {
  ok: true,
  slotEnabled: {
    HOME_728x90: true,
    HOME_RIGHT_300x250: true,
  },
};

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

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

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
  if (!origin) return res.status(200).json(DEFAULT_SETTINGS);

  try {
    const upstream = await fetch(`${origin}/api/public/ad-settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
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
    return res.status(200).json(data);
  } catch {
    // Fail open: if backend unreachable, keep slots enabled.
    return res.status(200).json(DEFAULT_SETTINGS);
  }
}
