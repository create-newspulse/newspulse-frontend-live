export type RegionalFeedQueryInput = {
  state: string;
  lang: string;
  district?: string | null;
  city?: string | null;
};

function normalizeToken(value: unknown): string {
  return String(value || '').trim();
}

function isInvalidOptionalToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v === 'undefined' || v === 'null' || v === 'none';
}

export function buildRegionalFeedSearchParams(input: RegionalFeedQueryInput): URLSearchParams {
  const state = normalizeToken(input.state);
  const lang = normalizeToken(input.lang);
  const params = new URLSearchParams();

  // Required
  params.set('state', state);
  params.set('lang', lang);

  // Optional
  const district = normalizeToken(input.district);
  if (!isInvalidOptionalToken(district)) params.set('district', district);

  const city = normalizeToken(input.city);
  if (!isInvalidOptionalToken(city)) params.set('city', city);

  return params;
}
