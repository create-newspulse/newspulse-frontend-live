import { getPublicApiBaseUrl } from './publicApiBase';

export type CurrentWeather = {
  tempC: number;
  condition: string;
};

function normalizeBaseUrl(raw: string): string {
  const v = String(raw || '').trim();
  return v.replace(/\/+$/g, '');
}

function normalizeCity(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function isValidCity(value: string): boolean {
  return /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(value);
}

export async function fetchCurrentWeather(options: {
  city: string;
  signal?: AbortSignal;
}): Promise<CurrentWeather> {
  const base = typeof window === 'undefined' ? normalizeBaseUrl(getPublicApiBaseUrl()) : '';

  const city = normalizeCity(options.city);
  if (!city || !isValidCity(city)) {
    throw new Error('Invalid weather city');
  }

  const qs = new URLSearchParams({ city });
  const url = `${base || ''}/api/public/weather/current?${qs.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Weather request failed (${res.status})`);
  }

  const data = await res.json().catch(() => null);

  const tempC = Number(
    (data as any)?.tempC ??
      (data as any)?.temp_c ??
      (data as any)?.temperatureC ??
      (data as any)?.temperature_c ??
      (data as any)?.temperature
  );

  const conditionRaw =
    (data as any)?.condition ??
    (data as any)?.summary ??
    (data as any)?.weather?.[0]?.main ??
    (data as any)?.weather?.[0]?.description;

  const condition = String(conditionRaw || '').trim();

  if (!Number.isFinite(tempC) || !condition) {
    throw new Error('Weather payload missing temp/condition');
  }

  return { tempC, condition };
}
