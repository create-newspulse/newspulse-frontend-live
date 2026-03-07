export type CurrentWeather = {
  tempC: number;
  condition: string;
};

function normalizeBaseUrl(raw: string): string {
  const v = String(raw || '').trim();
  return v.replace(/\/+$/g, '');
}

export async function fetchCurrentWeather(options: {
  city: string;
  signal?: AbortSignal;
}): Promise<CurrentWeather> {
  const base =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE || '') ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || '');

  const city = String(options.city || '').trim() || 'Ahmedabad';
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
