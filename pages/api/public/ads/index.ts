import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
  slot?: string;
};

export type PublicAdsBySlotResponse = {
  ok: boolean;
  enabled: boolean;
  ad: PublicAd | null;
  message?: string;
};

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function resolveAdImageUrl(ad: any): string {
  if (!ad) return '';
  return String(
    ad.imageUrl || ad.imageURL || ad.image || ad.imageSrc || ad.creativeUrl || ad.creativeURL || ''
  ).trim();
}

function pickAd(payload: any): PublicAd | null {
  if (!payload) return null;
  if (payload.ad) return payload.ad as PublicAd;
  if (Array.isArray(payload.ads)) return (payload.ads[0] as PublicAd) || null;
  if (Array.isArray(payload)) return (payload[0] as PublicAd) || null;
  if (payload.data) {
    if (Array.isArray(payload.data)) return (payload.data[0] as PublicAd) || null;
    return payload.data as PublicAd;
  }
  return payload as PublicAd;
}

function normalizeAd(ad: any): PublicAd | null {
  if (!ad) return null;
  const imageUrl = resolveAdImageUrl(ad);
  if (!imageUrl) return null;
  return { ...(ad as PublicAd), imageUrl };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PublicAdsBySlotResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, enabled: false, ad: null, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const slot = String(req.query.slot || '').trim();
  if (!slot) {
    return res.status(400).json({ ok: false, enabled: false, ad: null, message: 'MISSING_SLOT' });
  }

  const base = getPublicApiBaseUrl();
  const origin = normalizeOrigin(base);

  if (!origin) {
    return res.status(200).json({ ok: false, enabled: false, ad: null, message: 'BACKEND_NOT_CONFIGURED' });
  }

  const upstreamUrl = `${origin}/api/public/ads?slot=${encodeURIComponent(slot)}`;

  try {
    const upstream = await fetch(upstreamUrl, {
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

    const enabledRaw = json && typeof json === 'object' ? (json as any).enabled : undefined;
    const enabled = enabledRaw === false ? false : true;

    const picked = json && typeof json === 'object' ? ((json as any).ad ?? pickAd(json)) : null;
    const ad = normalizeAd(picked);

    return res.status(200).json({ ok: upstream.ok, enabled, ad: enabled ? ad : null });
  } catch {
    return res.status(200).json({ ok: false, enabled: true, ad: null, message: 'UPSTREAM_ERROR' });
  }
}
