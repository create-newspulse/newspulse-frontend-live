import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

type WeatherResponse =
  | { ok: true; tempC: number; condition: string }
  | { ok: false; message: string };

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function asSingleQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim().replace(/\s+/g, ' ');
}

function isValidCity(value: string): boolean {
  return /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(value);
}

function parseWeatherPayload(payload: any): { tempC: number; condition: string } | null {
  const tempC = Number(
    payload?.tempC ??
      payload?.temp_c ??
      payload?.temperatureC ??
      payload?.temperature_c ??
      payload?.temperature
  );

  const condition = String(
    payload?.condition ??
      payload?.summary ??
      payload?.weather?.[0]?.main ??
      payload?.weather?.[0]?.description ??
      ''
  ).trim();

  if (!Number.isFinite(tempC) || !condition) return null;
  return { tempC, condition };
}

async function readJson(upstream: Response): Promise<any> {
  const text = await upstream.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default async function publicCurrentWeatherHandler(
  req: NextApiRequest,
  res: NextApiResponse<WeatherResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const city = asSingleQueryValue(req.query.city as any);
  if (!city) {
    return res.status(400).json({ ok: false, message: 'CITY_REQUIRED' });
  }
  if (!isValidCity(city)) {
    return res.status(400).json({ ok: false, message: 'INVALID_CITY' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(503).json({ ok: false, message: 'WEATHER_BACKEND_NOT_CONFIGURED' });
  }

  const params = new URLSearchParams({ city });
  const targetUrl = `${origin}/api/public/weather/current?${params.toString()}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (upstream.status === 404) {
      return res.status(502).json({ ok: false, message: 'WEATHER_UPSTREAM_NOT_FOUND' });
    }

    const json = await readJson(upstream);
    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({ ok: false, message: 'WEATHER_UPSTREAM_ERROR' });
    }

    const weather = parseWeatherPayload(json);
    if (!weather) {
      return res.status(502).json({ ok: false, message: 'WEATHER_UPSTREAM_INVALID_PAYLOAD' });
    }

    return res.status(200).json({ ok: true, ...weather });
  } catch {
    return res.status(502).json({ ok: false, message: 'WEATHER_UPSTREAM_UNAVAILABLE' });
  }
}