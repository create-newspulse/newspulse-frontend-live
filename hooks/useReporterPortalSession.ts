import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

type ReporterSessionStatus = 'checking' | 'authenticated' | 'anonymous';
type ReporterBootstrapResult =
  | { status: 'authenticated'; session: ReporterPortalSession; data: any }
  | { status: 'anonymous'; reason: string | null; data?: any };

const REPORTER_SESSION_BOOTSTRAP_TIMEOUT_MS = 10_000;

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

const REPORTER_AUTH_STORAGE_KEYS = [
  'np_reporter_portal_session',
  'np_reporter_portal_otp',
  'np_reporter_portal_challenge',
  'reporterPortalSession',
  'reporterPortalToken',
  'reporterAuthToken',
  'reporterSession',
  'reporter_session',
] as const;

function isExpectedSignedOutSession(status: number, code: string, message: string): boolean {
  if (status !== 401) return false;
  const normalizedCode = code.toUpperCase();
  const normalizedMessage = message.toUpperCase();
  return normalizedCode === 'SESSION_EXPIRED'
    || normalizedMessage === 'SESSION_EXPIRED'
    || normalizedCode === 'REPORTER_SESSION_MISSING'
    || normalizedMessage === 'REPORTER_SESSION_MISSING'
    || normalizedCode === 'NO_SESSION'
    || normalizedMessage === 'NO_SESSION'
    || normalizedCode === 'UNAUTHENTICATED'
    || normalizedMessage === 'UNAUTHENTICATED';
}

function clearReporterAuthClientStorage() {
  if (typeof window === 'undefined') return;
  for (const key of REPORTER_AUTH_STORAGE_KEYS) {
    try {
      window.localStorage?.removeItem(key);
    } catch {}
    try {
      window.sessionStorage?.removeItem(key);
    } catch {}
  }
}

export async function bootstrapReporterSession(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<ReporterBootstrapResult> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, options?.timeoutMs ?? REPORTER_SESSION_BOOTSTRAP_TIMEOUT_MS);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromParent = () => controller.abort();

  try {
    if (options?.signal?.aborted) {
      controller.abort();
    } else {
      options?.signal?.addEventListener('abort', abortFromParent, { once: true });
    }

    const res = await fetch('/api/reporter-auth/session', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null as any);
    const responseCode = String(data?.code || '').trim();
    const responseMessage = String(data?.message || '').trim();

    if (res.ok && data?.ok === true && data?.session?.email) {
      return {
        status: 'authenticated',
        data,
        session: {
          email: data.session.email,
          expiresAt: typeof data.session.expiresAt === 'string' ? data.session.expiresAt : undefined,
          fullName: typeof data.session.fullName === 'string' ? data.session.fullName : undefined,
          name: typeof data.session.name === 'string' ? data.session.name : undefined,
          firstName: typeof data.session.firstName === 'string' ? data.session.firstName : undefined,
        },
      };
    }

    return {
      status: 'anonymous',
      reason: responseMessage || responseCode || (res.status === 401 ? 'REPORTER_SESSION_MISSING' : 'SESSION_CHECK_FAILED'),
      data,
    };
  } catch {
    return { status: 'anonymous', reason: timedOut ? 'SESSION_CHECK_TIMEOUT' : 'SESSION_CHECK_FAILED' };
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener('abort', abortFromParent);
  }
}

type ReporterPortalSessionValue = ReturnType<typeof useReporterPortalSessionState>;
const ReporterAuthContext = createContext<ReporterPortalSessionValue | null>(null);

function useReporterPortalSessionState(options?: UseReporterPortalSessionOptions) {
  const reportUnauthorizedReason = Boolean(options?.reportUnauthorizedReason);
  const skipInitialCheck = Boolean(options?.skipInitialCheck);
  const latestRequestRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const [session, setSession] = useState<ReporterPortalSession | null>(null);
  const [profile, setProfile] = useState<ReporterPortalProfile | null>(null);
  const [status, setStatus] = useState<ReporterSessionStatus>(skipInitialCheck ? 'anonymous' : 'checking');
  const [reason, setReason] = useState<string | null>(null);

  const applyAnonymousState = useCallback((nextReason: string | null, responseStatus?: number) => {
    setSession(null);
    const responseCode = String(nextReason || '').trim();
    if (responseStatus === 401 || isExpectedSignedOutSession(401, responseCode, responseCode)) {
      clearReporterAuthClientStorage();
      logReporterSessionDebug('session expired; continuing signed out', { status: responseStatus || 401, responseCode });
    }
    setProfile(null);
    if (!reportUnauthorizedReason && isExpectedSignedOutSession(401, responseCode, responseCode)) {
      setReason(null);
    } else {
      setReason(responseCode === 'REPORTER_SESSION_MISSING' ? 'SESSION_EXPIRED' : (responseCode || null));
    }
    setStatus('anonymous');
  }, [reportUnauthorizedReason]);

  const bootstrapSession = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setStatus('checking');
    logReporterSessionDebug('session request', {
      url: '/api/reporter-auth/session',
      credentialsIncluded: true,
    });

    try {
      const result = await bootstrapReporterSession({ signal: controller.signal });
      if (latestRequestRef.current !== requestId) return result;

      logReporterSessionDebug('session response', {
        url: '/api/reporter-auth/session',
        status: result.status === 'authenticated' ? 200 : 401,
        responseCode: result.status === 'anonymous' ? result.reason : null,
        credentialsIncluded: true,
      });

      if (result.status === 'authenticated') {
        const storedProfile = loadReporterPortalProfile();
        const responseIdentity = extractReporterIdentityFields(result.session, result.session.email);
        const displayName = getReporterDisplayName({
          fullName: responseIdentity.fullName || storedProfile?.fullName,
          name: responseIdentity.name || storedProfile?.name,
          firstName: responseIdentity.firstName || storedProfile?.firstName,
          email: result.session.email,
        }, '');
        setProfile(storedProfile);
        setSession({
          ...result.session,
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
        setStatus('authenticated');
        return result;
      }

      applyAnonymousState(result.reason || 'SESSION_CHECK_FAILED', result.reason === 'SESSION_CHECK_FAILED' || result.reason === 'SESSION_CHECK_TIMEOUT' ? 500 : 401);
      return result;
    } finally {
      if (latestRequestRef.current === requestId) {
        activeControllerRef.current = null;
        setStatus((current) => current === 'checking' ? 'anonymous' : current);
      }
    }
  }, [applyAnonymousState]);

  useEffect(() => {
    if (skipInitialCheck) {
      setProfile(null);
      setSession(null);
      setReason(null);
      setStatus('anonymous');
      return;
    }
    void bootstrapSession();
    return () => {
      latestRequestRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, [bootstrapSession, skipInitialCheck]);

  const logout = async () => {
    latestRequestRef.current += 1;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
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
    setProfile(null);
    setReason(null);
    setStatus('anonymous');
  };

  const isReady = status !== 'checking';

  return {
    session,
    reporter: session,
    authenticated: Boolean(session),
    profile,
    isReady,
    loading: status === 'checking',
    status,
    reason,
    bootstrapSession,
    logout,
  } as const;
}

export function ReporterAuthProvider({ children }: { children: ReactNode }) {
  const value = useReporterPortalSessionState({ reportUnauthorizedReason: true });
  return createElement(ReporterAuthContext.Provider, { value }, children);
}

export function useReporterPortalSession(options?: UseReporterPortalSessionOptions) {
  const context = useContext(ReporterAuthContext);
  if (context && !options?.skipInitialCheck) {
    if (!options?.reportUnauthorizedReason && context.reason === 'SESSION_EXPIRED') {
      return { ...context, reason: null } as const;
    }
    return context;
  }
  return useReporterPortalSessionState(options);
}