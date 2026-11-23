import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { clampTickerSpeedSeconds } from '../../../../lib/publicBroadcast';
import { PublicReadTimeoutError, withPublicReadDeadline } from '../../../../lib/publicReadDeadline';

const SNAPSHOT_TIMEOUT_MS = 6_000; // Shared by all reads, below the 10s Vercel API limit.
const RETRY_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`Broadcast upstream returned ${status}`);
  }
}

function isAccessDenied(error: unknown): error is UpstreamError {
  return error instanceof UpstreamError && (error.status === 401 || error.status === 403);
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(response.status);
  }
  const json: unknown = await response.json();
  if (isRecord(json) && (json.ok === false || json.success === false)) throw new Error('Broadcast read failed');
  return json;
}

function tickerSettings(raw: unknown, defaultSpeed: number) {
  const fields = isRecord(raw) ? raw : {};
  return {
    enabled: fields.enabled === undefined ? true : Boolean(fields.enabled),
    mode: 'AUTO',
    speedSec: clampTickerSpeedSeconds(fields.durationSec ?? fields.durationSeconds ?? fields.speedSec ?? fields.speedSeconds, defaultSpeed),
  };
}

function normalizeConfig(raw: unknown) {
  if (!isRecord(raw)) throw new Error('Invalid broadcast config');
  const cfg = isRecord(raw.config) ? raw.config : raw;
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const breaking = cfg.breaking ?? settings.breaking;
  const live = cfg.live ?? settings.live;
  return {
    _meta: { hasSettings: isRecord(breaking) || isRecord(live) },
    settings: { breaking: tickerSettings(breaking, 18), live: tickerSettings(live, 24) },
  };
}

async function readConfig(base: string, query: string, signal: AbortSignal) {
  try {
    return normalizeConfig(await readJson(`${base}/config${query}`, signal));
  } catch (primary) {
    if (signal.aborted || isAccessDenied(primary)) throw primary;
    try {
      return normalizeConfig(await readJson(`${base}/settings${query}`, signal));
    } catch (legacy) {
      // An items-only backend has no published settings to override the tickers.
      if (primary instanceof UpstreamError && primary.status === 404 && legacy instanceof UpstreamError && legacy.status === 404) {
        return normalizeConfig({});
      }
      throw legacy;
    }
  }
}

async function readItems(url: string, signal: AbortSignal): Promise<unknown[]> {
  const json = await readJson(url, signal);
  if (Array.isArray(json)) return json;
  if (isRecord(json) && Array.isArray(json.items)) return json.items;
  if (isRecord(json) && Array.isArray(json.data)) return json.data;
  throw new Error('Invalid broadcast items');
}

async function readSnapshot(origin: string, lang: string, signal: AbortSignal) {
  const base = `${origin}/api/public/broadcast`;
  const [config, breaking, live] = await Promise.all([
    readConfig(base, lang && `?lang=${lang}`, signal),
    readItems(`${base}/items?type=breaking${lang && `&lang=${lang}`}`, signal),
    readItems(`${base}/items?type=live${lang && `&lang=${lang}`}`, signal),
  ]);
  return { ok: true, ...config, items: { breaking, live } };
}

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const origin = getPublicApiBaseUrl();
  if (!origin) return res.status(503).json({ ok: false, message: 'BROADCAST_UNAVAILABLE' });
  const rawLang = String(req.query.lang || '').trim().toLowerCase();
  const lang = ['en', 'hi', 'gu'].includes(rawLang) ? rawLang : '';

  const connection = new AbortController();
  const abort = () => connection.abort();
  res.once('close', abort);
  req.once('aborted', abort);
  try {
    if (req.aborted || res.destroyed) return;
    const snapshot = await withPublicReadDeadline(SNAPSHOT_TIMEOUT_MS, signal =>
      readSnapshot(origin, lang, AbortSignal.any([signal, connection.signal])), connection.signal);
    if (connection.signal.aborted) return;

    // EventSource waits between snapshots in the browser, not inside the function.
    const data = JSON.stringify(snapshot);
    const id = createHash('sha1').update(data).digest('hex');
    const event = req.headers['last-event-id'] === id
      ? `event: ping\ndata: ${JSON.stringify({ t: Date.now() })}`
      : `event: broadcast_updated\ndata: ${data}`;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    res.end(`retry: ${RETRY_MS}\nid: ${id}\n${event}\n\n`);
  } catch (error) {
    if (connection.signal.aborted) return;
    const timeout = error instanceof PublicReadTimeoutError;
    res.status(timeout ? 504 : isAccessDenied(error) ? error.status : 502)
      .json({ ok: false, message: timeout ? 'BROADCAST_TIMEOUT' : 'BROADCAST_UNAVAILABLE' });
  } finally {
    abort(); // Cancel any sibling reads left pending by an upstream failure.
    res.off('close', abort);
    req.off('aborted', abort);
  }
}
