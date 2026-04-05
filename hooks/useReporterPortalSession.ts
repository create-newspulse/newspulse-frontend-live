import { useEffect, useState } from 'react';
import {
  clearReporterPortalSessionToken,
  getReporterPortalAuthHeaders,
  loadReporterPortalSessionToken,
  loadReporterPortalProfile,
  type ReporterPortalProfile,
  type ReporterPortalSession,
} from '../lib/reporterPortal';

type UseReporterPortalSessionOptions = {
  reportUnauthorizedReason?: boolean;
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

function clearReporterTokenIfUnchanged(requestToken: string | null) {
  if (!requestToken) {
    return;
  }

  const latestToken = loadReporterPortalSessionToken();
  if (latestToken === requestToken) {
    clearReporterPortalSessionToken();
  }
}

export function useReporterPortalSession(options?: UseReporterPortalSessionOptions) {
  const reportUnauthorizedReason = Boolean(options?.reportUnauthorizedReason);
  const [session, setSession] = useState<ReporterPortalSession | null>(null);
  const [profile, setProfile] = useState<ReporterPortalProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const requestHeaders: Record<string, string> = {
        Accept: 'application/json',
        ...getReporterPortalAuthHeaders(),
      };
      const requestToken = String(requestHeaders.Authorization || requestHeaders.authorization || '').trim().replace(/^Bearer\s+/i, '') || null;
      try {
        logReporterSessionDebug('session request', {
          url: '/api/reporter-auth/session',
          credentialsEnabled: true,
        });
        const res = await fetch('/api/reporter-auth/session', {
          method: 'GET',
          headers: requestHeaders,
          credentials: 'include',
        });
        const data = await res.json().catch(() => null as any);
        logReporterSessionDebug('session response', {
          url: '/api/reporter-auth/session',
          status: res.status,
          responseCode: String(data?.code || '').trim() || null,
          credentialsEnabled: true,
        });
        if (cancelled) return;
        const storedProfile = loadReporterPortalProfile();
        setProfile(storedProfile);

        if (res.ok && data?.ok === true && data?.session?.email) {
          setSession({
            email: data.session.email,
            expiresAt: typeof data.session.expiresAt === 'string' ? data.session.expiresAt : undefined,
            fullName: storedProfile?.fullName,
          });
          setReason(null);
        } else {
          setSession(null);
          clearReporterTokenIfUnchanged(requestToken);
          if (res.status === 401 && data?.message === 'SESSION_EXPIRED' && !reportUnauthorizedReason) {
            setReason(null);
          } else {
            setReason(typeof data?.message === 'string' ? data.message : null);
          }
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          clearReporterTokenIfUnchanged(requestToken);
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
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/reporter-auth/logout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...getReporterPortalAuthHeaders(),
        },
        credentials: 'include',
      });
    } catch {}
    clearReporterPortalSessionToken();
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