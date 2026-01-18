import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function safeJson(res: Response): Promise<any | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sseWrite(res: NextApiResponse, payload: { event?: string; data?: any }) {
  if (payload.event) res.write(`event: ${payload.event}\n`);
  const data = payload.data === undefined ? null : payload.data;
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function hashOf(json: any): string {
  const str = JSON.stringify(json ?? null);
  return crypto.createHash('sha1').update(str).digest('hex');
}

function clampDurationSec(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(10, n));
}

function unwrapItems(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

function normalizeConfig(raw: any) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const cfg = root.config && typeof root.config === 'object' ? root.config : root;
  const settings = root.settings && typeof root.settings === 'object' ? root.settings : null;

  const breakingSrc = (cfg as any).breaking ?? (settings as any)?.breaking ?? null;
  const liveSrc = (cfg as any).live ?? (settings as any)?.live ?? null;

  const breakingEnabled = breakingSrc?.enabled;
  const liveEnabled = liveSrc?.enabled;

  const breakingDuration =
    breakingSrc?.durationSec ?? breakingSrc?.durationSeconds ?? breakingSrc?.speedSec ?? breakingSrc?.speedSeconds;
  const liveDuration = liveSrc?.durationSec ?? liveSrc?.durationSeconds ?? liveSrc?.speedSec ?? liveSrc?.speedSeconds;

  return {
    breaking: {
      enabled: breakingEnabled === undefined ? true : Boolean(breakingEnabled),
      durationSec: clampDurationSec(breakingDuration, 18),
    },
    live: {
      enabled: liveEnabled === undefined ? true : Boolean(liveEnabled),
      durationSec: clampDurationSec(liveDuration, 24),
    },
  };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers (Node)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).flushHeaders?.();

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);

  const qLang = String((req.query as any)?.lang || '').toLowerCase().trim();
  const langParam = qLang === 'en' || qLang === 'hi' || qLang === 'gu' ? `&lang=${encodeURIComponent(qLang)}` : '';

  let closed = false;
  const markClosed = () => {
    closed = true;
  };

  req.on('close', markClosed);
  req.on('aborted', markClosed);

  const fetchConfig = async (): Promise<any | null> => {
    if (!origin) return null;
    // Try config, then fallback settings.
    const r1 = await fetch(`${origin}/api/public/broadcast/config`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      cache: 'no-store',
    }).catch(() => null as any);
    if (r1) {
      const j = await safeJson(r1);
      if (r1.ok && j) return j;
    }

    const r2 = await fetch(`${origin}/api/public/broadcast/settings`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      cache: 'no-store',
    }).catch(() => null as any);
    if (r2) {
      const j = await safeJson(r2);
      if (r2.ok && j) return j;
    }

    return null;
  };

  const fetchItems = async (type: 'breaking' | 'live'): Promise<any[]> => {
    if (!origin) return [];
    const url = `${origin}/api/public/broadcast/items?type=${encodeURIComponent(type)}${langParam}`;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      cache: 'no-store',
    }).catch(() => null as any);
    if (!upstream) return [];
    const json = await safeJson(upstream);
    if (!upstream.ok || !json) return [];
    return unwrapItems(json);
  };

  const buildPayload = async (): Promise<any> => {
    // Fail-open: allow clients to connect even without configured origin.
    const cfgRaw = (await fetchConfig()) ?? { ok: true, config: { breaking: { enabled: true, durationSec: 18 }, live: { enabled: true, durationSec: 24 } } };
    const normalizedCfg = normalizeConfig((cfgRaw as any).config ? cfgRaw : { config: (cfgRaw as any).settings ?? cfgRaw });

    const [breakingItems, liveItems] = await Promise.all([fetchItems('breaking'), fetchItems('live')]);

    return {
      ok: true,
      _meta: { hasSettings: true },
      settings: {
        breaking: { enabled: normalizedCfg.breaking.enabled, mode: 'AUTO', speedSec: normalizedCfg.breaking.durationSec },
        live: { enabled: normalizedCfg.live.enabled, mode: 'AUTO', speedSec: normalizedCfg.live.durationSec },
      },
      items: { breaking: breakingItems, live: liveItems },
    };
  };

  let lastHash = '';

  // Initial payload
  const first = await buildPayload().catch(() => ({
    ok: true,
    _meta: { hasSettings: false },
    settings: { breaking: { enabled: true, mode: 'AUTO', speedSec: 18 }, live: { enabled: true, mode: 'AUTO', speedSec: 24 } },
    items: { breaking: [], live: [] },
  }));

  lastHash = hashOf(first);
  sseWrite(res, { event: 'broadcast_updated', data: first });

  const pingTimer = setInterval(() => {
    if (closed) return;
    sseWrite(res, { event: 'ping', data: { t: Date.now() } });
  }, 15_000);

  const pollTimer = setInterval(async () => {
    if (closed) return;
    const next = await buildPayload().catch(() => null);
    if (!next) return;

    const h = hashOf(next);
    if (h === lastHash) return;

    lastHash = h;
    sseWrite(res, { event: 'broadcast_updated', data: next });
  }, 5_000);

  const cleanup = () => {
    clearInterval(pingTimer);
    clearInterval(pollTimer);
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
}
