export const REPORTER_PRIVATE_RESET = 'np:reporter-private-reset';
export const REPORTER_LIFECYCLE = 'np:reporter-lifecycle';
export const REPORTER_INVALID = 'np:reporter-session-invalid';
export const REPORTER_LIFECYCLE_KEY = 'np_reporter_lifecycle_v1';
const privateKeys = [
  'np_cr_profile_v1', 'np_cr_email', 'npCommunityReporterProfile', 'np_communityReporterEmail', 'np_communityReporterId',
  'np_reporter_portal_session', 'np_reporter_portal_otp', 'np_reporter_portal_challenge',
  'reporterPortalSession', 'reporterPortalToken', 'reporterAuthToken', 'reporterSession', 'reporter_session',
] as const;

export function removeReporterStorageKeys() {
  if (typeof window === 'undefined') return;
  for (const key of privateKeys) {
    try { window.localStorage.removeItem(key); } catch {}
    try { window.sessionStorage.removeItem(key); } catch {}
  }
}

export function clearReporterPrivateStorage() {
  if (typeof window === 'undefined') return;
  removeReporterStorageKeys();
  window.dispatchEvent(new Event(REPORTER_PRIVATE_RESET));
}

export function signalReporterSessionInvalid(requestStamp?: string) {
  if (typeof window === 'undefined' || (requestStamp !== undefined && requestStamp !== reporterLifecycleStamp())) return;
  clearReporterPrivateStorage();
  window.dispatchEvent(new Event(REPORTER_INVALID));
}

// Only a non-identifying transition stamp is shared across tabs. It can deny
// access, never grant it. Its cookie counterpart lets SSR observe logout intent
// even when the POST never reached the frontend server.
type Phase = 'pending' | 'signed-out' | 'check';
let volatileStamp = '';
export function reporterLifecycleStamp(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem(REPORTER_LIFECYCLE_KEY);
    if (stored) return stored;
  } catch {}
  return volatileStamp;
}

export function reporterClientLock(): 'pending' | 'signed-out' | null {
  const stamp = reporterLifecycleStamp();
  let cookie = '';
  try { cookie = document.cookie.match(/(?:^|;\s*)np_reporter_logout=(pending|signed-out)(?:;|$)/)?.[1] || ''; } catch {}
  if (cookie === 'pending' || stamp.startsWith('pending:')) return 'pending';
  return cookie === 'signed-out' || stamp.startsWith('signed-out:') ? 'signed-out' : null;
}

function transition(phase: Phase): string {
  const stamp = `${phase}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  volatileStamp = stamp;
  try { window.localStorage.setItem(REPORTER_LIFECYCLE_KEY, stamp); } catch {}
  try {
    document.cookie = `np_reporter_logout=${phase === 'check' ? '' : phase}; Path=/; SameSite=Lax; Max-Age=${phase === 'check' ? 0 : 34560000}${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {}
  clearReporterPrivateStorage();
  window.dispatchEvent(new Event(REPORTER_LIFECYCLE));
  return stamp;
}

export function beginReporterLogout(): string {
  return transition('pending');
}
export function finishReporterLogout(stamp: string): boolean {
  if (reporterLifecycleStamp() !== stamp) return false;
  transition('signed-out');
  return true;
}
export function verifiedReporterLogin(stamp: string): boolean {
  if (reporterLifecycleStamp() !== stamp || reporterClientLock() === 'pending') return false;
  transition('check');
  return true;
}
export function confirmedReporterEmailChange(stamp: string) {
  if (reporterLifecycleStamp() === stamp) transition('signed-out');
}
