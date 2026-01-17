import type { NextApiRequest, NextApiResponse } from 'next';

type SlotName = 'HOME_728x90' | 'HOME_RIGHT_300x250' | string;

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
  slot?: string;
};

type PublicAdResponse = { ok: boolean; ad: PublicAd | null };

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '');

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<PublicAdResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, ad: null });
  }

  const slot = String(req.query.slot || '').trim() as SlotName;
  if (!slot) return res.status(400).json({ ok: false, ad: null });

  if (!BACKEND_URL) {
    return res.status(200).json({ ok: false, ad: null });
  }

  try {
    // Preferred upstream path
    const preferred = await fetch(`${BACKEND_URL}/api/public/ads/slot/${encodeURIComponent(slot)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (preferred.ok) {
      const json = await preferred.json().catch(() => null);
      const ad = pickAd(json);
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json({ ok: true, ad: ad && ad.imageUrl ? ad : null });
    }

    // Backward-compatible fallback
    const fallback = await fetch(`${BACKEND_URL}/api/public/ads?slot=${encodeURIComponent(slot)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const json = await fallback.json().catch(() => null);
    const ad = fallback.ok ? pickAd(json) : null;

    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json({ ok: fallback.ok, ad: ad && ad.imageUrl ? ad : null });
  } catch {
    return res.status(200).json({ ok: false, ad: null });
  }
}
