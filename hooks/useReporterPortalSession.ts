import { useEffect, useState } from 'react';
import {
  extractReporterIdentityFields,
  getReporterDisplayName,
  loadReporterPortalProfile,
  type ReporterPortalProfile,
  type ReporterPortalSession,
} from '../lib/reporterPortal';

type UseReporterPortalSessionOptions = {
  reportUnauthorizedReason?: boolean;
  skipInitialCheck?: boolean;
};

function shouldLogReporterSessionDebug(): boolean {
  const isJest = Boolean((globalThis as any)?.jest) || (typeof process !== 'undefined' && Boolean((process.env as any)?.JEST_WORKER_ID));
  return typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !isJest;
}

function logReporterSessionDebug(event: string, details: Record<string, unknown>) {
  if (!shouldLogReporterSessionDebug()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`[Reporter Portal] ${event}`, details);
}

export function useReporterPortalSession(options?: UseReporterPortalSessionOptions) {
  const reportUnauthorizedReason = Boolean(options?.reportUnauthorizedReason);
  const skipInitialCheck = Boolean(options?.skipInitialCheck);
  const [session, setSession] = useState<ReporterPortalSession | null>(null);
  const [profile, setProfile] = useState<ReporterPortalProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (skipInitialCheck) {
      setProfile(loadReporterPortalProfile());
      setSession(null);
      setReason(null);
      setIsReady(true);
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      const requestUrl = '/api/reporter-auth/session';
      const credentialsEnabled = true;
      try {
        logReporterSessionDebug('session request', {
          url: requestUrl,
          credentialsIncluded: credentialsEnabled,
        });
        const res = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          credentials: 'include',
        });
        const data = await res.json().catch(() => null as any);
        logReporterSessionDebug('session response', {
          url: requestUrl,
          status: res.status,
          responseCode: String(data?.code || '').trim() || null,
          credentialsIncluded: credentialsEnabled,
        });
        if (cancelled) return;
        const storedProfile = loadReporterPortalProfile();
        setProfile(storedProfile);

        if (res.ok && data?.ok === true && data?.session?.email) {
          const responseIdentity = extractReporterIdentityFields(data?.session, data.session.email);
          const displayName = getReporterDisplayName({
            fullName: responseIdentity.fullName || storedProfile?.fullName,
            name: responseIdentity.name || storedProfile?.name,
            firstName: responseIdentity.firstName || storedProfile?.firstName,
            email: data.session.email,
          }, '');
          setSession({
            email: data.session.email,
            expiresAt: typeof data.session.expiresAt === 'string' ? data.session.expiresAt : undefined,
            fullName: displayName || undefined,
            name: responseIdentity.name || storedProfile?.name,
            firstName: responseIdentity.firstName || storedProfile?.firstName,
          });
          setProfile((current) => ({
            ...(current || {}),
            ...(storedProfile || {}),
            ...responseIdentity,
          }));
          setReason(null);
        } else {
          setSession(null);
          if (res.status === 401 && (data?.message === 'SESSION_EXPIRED' || data?.code === 'SESSION_EXPIRED') && !reportUnauthorizedReason) {
            setReason(null);
          } else {
            const nextReason = String(data?.message || data?.code || '').trim();
            setReason(nextReason === 'REPORTER_SESSION_MISSING' ? 'SESSION_EXPIRED' : (nextReason || null));
          }
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setProfile(loadReporterPortalProfile());
          setReason('SESSION_CHECK_FAILED');
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [skipInitialCheck]);

  const logout = async () => {
    try {
      await fetch('/api/reporter-auth/logout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });
    } catch {}
    setSession(null);
    setReason(null);
  };

  return {
    session,
    profile,
    isReady,
    reason,
    logout,
  } as const;
}