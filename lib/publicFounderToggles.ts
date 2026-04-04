import { getPublicApiBaseUrl } from './publicApiBase';

export type PublicFounderToggles = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
  updatedAt: string | null;
};

export const DEFAULT_PUBLIC_FOUNDER_TOGGLES: PublicFounderToggles = {
  communityReporterClosed: false,
  reporterPortalClosed: false,
  updatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizePublicFounderToggles(payload: unknown): PublicFounderToggles {
  const root = isRecord(payload) ? payload : null;
  const settings = root && isRecord(root.settings) ? root.settings : root;

  return {
    communityReporterClosed: Boolean(settings?.communityReporterClosed),
    reporterPortalClosed: Boolean(settings?.reporterPortalClosed),
    updatedAt: typeof settings?.updatedAt === 'string' ? settings.updatedAt : null,
  };
}

export async function fetchPublicFounderToggles(
  input: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<PublicFounderToggles> {
  const endpoint = String(input.endpoint || '/api/public/feature-toggles').trim() || '/api/public/feature-toggles';
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null as unknown);

    if (!response.ok) {
      return DEFAULT_PUBLIC_FOUNDER_TOGGLES;
    }

    return normalizePublicFounderToggles(data);
  } catch {
    return DEFAULT_PUBLIC_FOUNDER_TOGGLES;
  }
}

export async function fetchServerPublicFounderToggles(fetchImpl: typeof fetch = fetch): Promise<PublicFounderToggles> {
  const base = getPublicApiBaseUrl().trim().replace(/\/+$/, '');
  if (!base) {
    return DEFAULT_PUBLIC_FOUNDER_TOGGLES;
  }

  return fetchPublicFounderToggles({
    endpoint: `${base}/api/public/feature-toggles`,
    fetchImpl,
  });
}