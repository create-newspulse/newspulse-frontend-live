import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import {
  normalizePublicTickerAds,
  type PublicTickerAd,
  type TickerChannel,
} from '../../../../lib/publicTickerAds';
import type { BroadcastLang } from '../../../../lib/publicBroadcast';

type PublicTickerAdsResponse = {
  ok: boolean;
  enabled: boolean;
  ads: PublicTickerAd[];
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

function normalizeLang(raw: unknown): BroadcastLang {
  const value = String(raw || 'en').trim().toLowerCase();
  return value === 'hi' || value === 'gu' ? (value as BroadcastLang) : 'en';
}

function normalizeChannel(raw: unknown): TickerChannel | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'breaking' || value === 'live') return value as TickerChannel;
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PublicTickerAdsResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, enabled: false, ads: [], message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const lang = normalizeLang(req.query.lang);
  const channel = normalizeChannel(req.query.channel);

  if (!channel) {
    return res.status(400).json({ ok: false, enabled: false, ads: [], message: 'MISSING_OR_INVALID_CHANNEL' });
  }

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(200).json({ ok: false, enabled: false, ads: [], message: 'BACKEND_NOT_CONFIGURED' });
  }

  const upstreamUrl = `${origin}/api/public/ticker-ads/active?lang=${encodeURIComponent(lang)}&channel=${encodeURIComponent(channel)}`;

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

    const normalized = normalizePublicTickerAds(json, { lang, fallbackChannel: channel });
    return res.status(200).json({ ok: upstream.ok && normalized.ok, enabled: normalized.enabled, ads: normalized.ads });
  } catch {
    return res.status(200).json({ ok: false, enabled: true, ads: [], message: 'UPSTREAM_ERROR' });
  }
}