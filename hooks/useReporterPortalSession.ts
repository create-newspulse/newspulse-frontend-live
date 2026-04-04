import { useEffect, useState } from 'react';
import {
  loadReporterPortalProfile,
  type ReporterPortalProfile,
  type ReporterPortalSession,
} from '../lib/reporterPortal';

export function useReporterPortalSession() {
  const [session, setSession] = useState<ReporterPortalSession | null>(null);
  const [profile, setProfile] = useState<ReporterPortalProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const res = await fetch('/api/reporter-auth/session', { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null as any);
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
          setReason(typeof data?.message === 'string' ? data.message : null);
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
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/reporter-auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
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