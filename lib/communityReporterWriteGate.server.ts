import { reporterBackendOrigin, publicReporterBackendFetch, reporterIngressAvailable, type ReporterRequest } from './reporterBackend.server';
import { record } from './reporterStories';

// Check the actual write gates, not the display proxies (which may synthesize open defaults).
export async function communityReporterWriteGate(account: boolean, req: ReporterRequest = { headers: {}, cookies: {} }): Promise<'open' | 'paused' | 'unavailable'> {
  try {
    if (!reporterIngressAvailable(req)) return 'unavailable';
    const base = reporterBackendOrigin(req);
    const init: RequestInit = {
      method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error',
      cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4_000),
    };
    const [settings, mode] = await Promise.all([
      publicReporterBackendFetch(req, '/api/public/community/settings'),
      fetch(`${base}/api/system/public-mode`, init),
    ]);
    // Phase 5A/B does not mount the optional global-mode endpoint. Distinguish
    // an absent endpoint from malformed evidence or a temporary upstream failure.
    if (mode.status !== 404) {
      if (!mode.ok) return 'unavailable';
      const value: unknown = await mode.json();
      if (!record(value) || value.ok !== true || typeof value.readOnly !== 'boolean'
        || !['NORMAL', 'READONLY', 'LOCKDOWN'].includes(String(value.mode))) return 'unavailable';
      if (value.readOnly || value.mode !== 'NORMAL') return 'paused';
    }
    if (!settings.ok) return 'unavailable';
    const value: unknown = await settings.json();
    if (!record(value) || value.ok !== true || !record(value.settings)) return 'unavailable';
    const s = value.settings;
    const flags = ['communityReporterEnabled', 'communityReporterClosed', 'allowNewSubmissions',
      ...(account ? ['reporterPortalClosed', 'allowMyStoriesPortal'] : [])];
    if (flags.some(flag => typeof s[flag] !== 'boolean')) return 'unavailable';
    return s.communityReporterEnabled && !s.communityReporterClosed && s.allowNewSubmissions
      && (!account || (!s.reporterPortalClosed && s.allowMyStoriesPortal)) ? 'open' : 'paused';
  } catch {
    return 'unavailable';
  }
}
