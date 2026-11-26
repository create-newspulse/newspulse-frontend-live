import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { ReporterPortalSession } from '../lib/reporterPortal';
import {
  REPORTER_INVALID, REPORTER_LIFECYCLE, REPORTER_LIFECYCLE_KEY, beginReporterLogout, clearReporterPrivateStorage,
  finishReporterLogout, removeReporterStorageKeys, reporterClientLock, reporterLifecycleStamp,
} from '../lib/reporterPrivacy';

type Options = { reportUnauthorizedReason?: boolean; skipInitialCheck?: boolean };
type Anonymous = { status: 'anonymous'; reason: string | null };
type Result = Anonymous | { status: 'authenticated'; session: ReporterPortalSession };
type State = Result | { status: 'checking' };
const anonymous = (reason: string | null = null): Anonymous => ({ status: 'anonymous', reason });
const locked = () => reporterClientLock() === 'pending' ? anonymous('LOGOUT_UNCONFIRMED') : anonymous();
const safeReasons = new Set(['LOGOUT_UNCONFIRMED', 'SESSION_EXPIRED', 'REPORTER_SESSION_MISSING', 'REPORTER_PORTAL_CLOSED', 'REPORTER_PORTAL_FORBIDDEN']);

export async function bootstrapReporterSession(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<Result> {
  if (reporterClientLock()) return locked();
  const stamp = reporterLifecycleStamp();
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  const timer = setTimeout(() => { timedOut = true; abort(); }, options?.timeoutMs ?? 10_000);
  try {
    if (options?.signal?.aborted) return anonymous();
    options?.signal?.addEventListener('abort', abort, { once: true });
    const response = await fetch('/api/reporter-auth/session', {
      method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    const data = await response.json();
    if (reporterClientLock() || stamp !== reporterLifecycleStamp() || controller.signal.aborted) return locked();
    const s = data?.session;
    if (response.status === 200 && data?.ok === true && data.authenticated === true
      && typeof s?.accountId === 'string' && /^[a-f0-9]{24}$/i.test(s.accountId)
      && typeof s.email === 'string' && /^[^\s@]+@[^\s@]+$/.test(s.email)
      && typeof s.expiresAt === 'string' && Date.parse(s.expiresAt) > Date.now()) {
      return { status: 'authenticated', session: { accountId: s.accountId, email: s.email, expiresAt: s.expiresAt,
        ...(typeof s.fullName === 'string' ? { fullName: s.fullName } : {}) } };
    }
    return anonymous(safeReasons.has(data?.code) ? data.code : response.status === 401 ? 'REPORTER_SESSION_MISSING' : 'SESSION_CHECK_FAILED');
  } catch {
    return anonymous(timedOut ? 'SESSION_CHECK_TIMEOUT' : 'SESSION_CHECK_FAILED');
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', abort);
  }
}

let signOutInFlight: Promise<boolean> | null = null;
function logout(): Promise<boolean> {
  if (signOutInFlight) return signOutInFlight;
  const stamp = beginReporterLogout();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  signOutInFlight = (async () => {
    try {
      const response = await fetch('/api/reporter-auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store',
        redirect: 'error', headers: { Accept: 'application/json' }, signal: controller.signal });
      const data = await response.json();
      return response.status === 200 && data?.ok === true && data.revoked === true && finishReporterLogout(stamp);
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => { signOutInFlight = null; });
  return signOutInFlight;
}

function useSessionState(skip: boolean, disabled = false) {
  const [state, setState] = useState<State>(skip ? anonymous() : { status: 'checking' });
  const active = useRef<AbortController | null>(null);
  const lastAccount = useRef<string | null>(null);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
  }, []);
  const mask = useCallback((next: State) => {
    cancel();
    lastAccount.current = null;
    clearReporterPrivateStorage();
    setState(next);
  }, [cancel]);
  const bootstrapSession = useCallback(async (): Promise<Result> => {
    cancel();
    if (reporterClientLock()) {
      const result = locked();
      if (lastAccount.current !== null) clearReporterPrivateStorage();
      lastAccount.current = null;
      removeReporterStorageKeys();
      setState(result);
      return result;
    }
    const controller = new AbortController();
    active.current = controller;
    setState({ status: 'checking' });
    const result = await bootstrapReporterSession({ signal: controller.signal });
    if (active.current !== controller || controller.signal.aborted) return locked();
    active.current = null;
    if (result.status === 'authenticated') {
      if (lastAccount.current !== result.session.accountId) clearReporterPrivateStorage();
      lastAccount.current = result.session.accountId;
    } else {
      if (lastAccount.current !== null) clearReporterPrivateStorage();
      lastAccount.current = null;
      removeReporterStorageKeys();
    }
    setState(result);
    return result;
  }, [cancel]);

  useEffect(() => {
    if (disabled) return;
    removeReporterStorageKeys();
    const refresh = () => { void bootstrapSession(); };
    const onChange = () => {
      if (reporterClientLock()) mask(locked());
      else {
        mask({ status: 'checking' });
        if (!skip) void bootstrapSession();
        else setState(anonymous());
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === REPORTER_LIFECYCLE_KEY || event.key === null) onChange();
    };
    const onInvalid = () => mask(reporterClientLock() ? locked() : anonymous('SESSION_EXPIRED'));
    // Remove the private React subtree before a page is frozen into BFCache.
    const onHide = () => flushSync(() => mask({ status: 'checking' }));
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    const onFocus = () => { if (!skip) refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') onFocus(); };
    window.addEventListener(REPORTER_LIFECYCLE, onChange);
    window.addEventListener(REPORTER_INVALID, onInvalid);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    if (!skip || reporterClientLock()) refresh();
    return () => {
      cancel();
      window.removeEventListener(REPORTER_LIFECYCLE, onChange);
      window.removeEventListener(REPORTER_INVALID, onInvalid);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bootstrapSession, cancel, disabled, mask, skip]);

  const session = state.status === 'authenticated' ? state.session : null;
  useEffect(() => {
    if (!session?.expiresAt || disabled) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(() => {
      if (remaining > 2_147_483_647) void bootstrapSession();
      else mask(anonymous('SESSION_EXPIRED'));
    }, Math.min(Math.max(remaining, 0), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [session, disabled, bootstrapSession, mask]);

  return { session, reporter: session, profile: session, status: state.status, reason: state.status === 'anonymous' ? state.reason : null,
    authenticated: !!session, loading: state.status === 'checking', isReady: state.status !== 'checking', bootstrapSession, logout } as const;
}

const ReporterAuthContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function ReporterAuthProvider({ children }: { children: ReactNode }) {
  const value = useSessionState(false);
  return createElement(ReporterAuthContext.Provider, { value }, children);
}
export function useReporterPortalSession(options?: Options) {
  const context = useContext(ReporterAuthContext);
  const own = useSessionState(!!options?.skipInitialCheck, !!context);
  const value = context || own;
  if (!options?.reportUnauthorizedReason && (value.reason === 'SESSION_EXPIRED' || value.reason === 'REPORTER_SESSION_MISSING')) {
    return { ...value, reason: null };
  }
  return value;
}
