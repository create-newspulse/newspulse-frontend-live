import { getPublicApiBaseUrl } from './publicApiBase';

export type PublicFounderToggles = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
  youthPulseSubmissionsClosed: boolean;
  viralVideosFrontendEnabled: boolean;
  updatedAt: string | null;
};

export const DEFAULT_PUBLIC_FOUNDER_TOGGLES: PublicFounderToggles = {
  communityReporterClosed: false,
  reporterPortalClosed: false,
  youthPulseSubmissionsClosed: false,
  viralVideosFrontendEnabled: true,
  updatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizePublicFounderToggles(payload: unknown): PublicFounderToggles {
  const root = isRecord(payload) ? payload : null;
  const settings = root && isRecord(root.settings) ? root.settings : root;
  const viralVideos = settings && isRecord((settings as any).viralVideos) ? (settings as any).viralVideos : null;
  const features = settings && isRecord((settings as any).features) ? (settings as any).features : null;
  const featureViralVideos = features && isRecord((features as any).viralVideos) ? (features as any).viralVideos : null;
  const viralVideosFrontendEnabled =
    (viralVideos as any)?.frontendEnabled ??
    (featureViralVideos as any)?.frontendEnabled ??
    (settings as any)?.viralVideosFrontendEnabled ??
    (settings as any)?.viralVideos?.enabled ??
    (settings as any)?.showViralVideos;

  return {
    communityReporterClosed: Boolean(settings?.communityReporterClosed),
    reporterPortalClosed: Boolean(settings?.reporterPortalClosed),
    youthPulseSubmissionsClosed: Boolean(
      settings?.youthPulseSubmissionsClosed ?? settings?.youthPulseSubmissionClosed
    ),
    viralVideosFrontendEnabled: typeof viralVideosFrontendEnabled === 'boolean' ? viralVideosFrontendEnabled : true,
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