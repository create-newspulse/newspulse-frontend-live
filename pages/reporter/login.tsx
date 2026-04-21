import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { fetchPublicSettings } from '../../lib/communityReporterApi';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import { extractReporterIdentityFields, loadReporterPortalProfile, normalizeReporterEmail, saveReporterPortalProfile } from '../../lib/reporterPortal';
import type { FeatureToggleProps } from '../../types/community-reporter';

const DEFAULT_PORTAL_TARGET = '/reporter/dashboard';

type ReporterChallengeState = {
  requestId: number;
  email: string;
  expiresAt: string | null;
  debugCode: string | null;
  resendCount: number;
};

type ReporterSendRequestState = {
  requestId: string;
  email: string;
  startedAt: number;
};

function isSessionExpiredCode(code: string | null): boolean {
  return code === 'SESSION_EXPIRED' || code === 'REPORTER_SESSION_MISSING' || code === 'REPORTER_VERIFY_SESSION_MISSING';
}

function getSafeNextTarget(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/reporter/')) {
    return DEFAULT_PORTAL_TARGET;
  }
  return candidate;
}

function resolveReporterAuthUrl(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}

function logReporterAuthEvent(event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  console.info(`[Reporter Portal] ${event}`, details);
}

function logReporterAuthFailure(event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  console.error(`[Reporter Portal] ${event}`, details);
}

function logReporterAuthHandledFailure(event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  console.info(`[Reporter Portal] ${event}`, details);
}

function logReporterAuthStateTransition(from: 'email' | 'code' | 'success', to: 'email' | 'code' | 'success', details: Record<string, unknown>) {
  logReporterAuthEvent('ui state transition', {
    from,
    to,
    ...details,
  });
}

function getReporterResponseCode(data: any): string | null {
  const code = String(data?.code || data?.message || '').trim();
  return code || null;
}

function persistReporterIdentity(source: any, fallbackEmail: string) {
  saveReporterPortalProfile({
    ...(loadReporterPortalProfile() || {}),
    ...extractReporterIdentityFields(source, fallbackEmail),
  });
}

function isExpectedReporterAuthFailure(status: number | null, code: string | null, data?: any): boolean {
  if (isSessionExpiredCode(code)) {
    return true;
  }
  if (status === 401) {
    return true;
  }
  if ((status || 0) >= 500) {
    return true;
  }
  if (typeof data?.attemptsRemaining === 'number') {
    return true;
  }
  return code === 'OTP_EXPIRED_OR_MISSING'
    || code === 'REPORTER_OTP_EXPIRED'
    || code === 'REPORTER_OTP_MISSING'
    || code === 'OTP_REPLACED_BY_NEWER_CODE'
    || code === 'REPORTER_OTP_REPLACED'
    || code === 'NEWER_CODE_ACTIVE'
    || code === 'OTP_INVALID'
    || code === 'REPORTER_OTP_INVALID'
    || code === 'INVALID_OTP'
    || code === 'SESSION_CHECK_FAILED';
}

function getRequestCodeErrorMessage(code: string | null, status: number | null, data?: any): string {
  if (status === 429 || (code && /RATE|TOO_MANY/i.test(code))) {
    return 'Please wait a moment before requesting another verification code.';
  }
  if (code === 'INVALID_EMAIL' || code === 'VALID_EMAIL_REQUIRED') {
    return 'Enter the same valid email address you use for community reporter submissions.';
  }

  const responseMessage = String(data?.message || '').trim();
  const responseCode = String(data?.code || '').trim();
  if (responseMessage) {
    return responseCode && responseCode !== responseMessage ? `${responseCode}: ${responseMessage}` : responseMessage;
  }
  if (responseCode) {
    return responseCode;
  }

  return 'Could not send a verification code right now.';
}

function getVerifyCodeErrorMessage(code: string | null, challenge: ReporterChallengeState | null, data?: any): string {
  if (isSessionExpiredCode(code)) {
    return 'Your verification session expired. Request a new code.';
  }
  if (typeof data?.attemptsRemaining === 'number' && data.attemptsRemaining <= 0) {
    return 'Too many incorrect attempts. Request a fresh code.';
  }
  if (code === 'OTP_EXPIRED_OR_MISSING' || code === 'REPORTER_OTP_EXPIRED' || code === 'REPORTER_OTP_MISSING') {
    return 'This verification code expired. Request a fresh code.';
  }
  if (code === 'OTP_REPLACED_BY_NEWER_CODE' || code === 'REPORTER_OTP_REPLACED' || code === 'NEWER_CODE_ACTIVE') {
    return 'A newer verification code was sent. Use the most recent code only.';
  }
  if (code === 'OTP_INVALID' || code === 'REPORTER_OTP_INVALID' || code === 'INVALID_OTP') {
    return `That verification code is incorrect.${typeof data?.attemptsRemaining === 'number' ? ` Attempts remaining: ${data.attemptsRemaining}.` : ''}`;
  }
  if (code === 'SESSION_CHECK_FAILED' || code === 'REPORTER_VERIFY_CODE_FAILED' || (typeof data?.status === 'number' && data.status >= 500)) {
    return 'Verification is temporarily unavailable. Try again shortly.';
  }
  return 'Could not verify this code.';
}

function getVerificationSessionExpiredMessage() {
  return 'Your verification session expired. Request a new code.';
}

function shouldResetToEmailAfterRequestFailure(status: number | null, code: string | null): boolean {
  if (status === 429 || (code && /RATE|TOO_MANY/i.test(code))) {
    return false;
  }
  return (status || 0) >= 500;
}

function getRequestCodeUnavailableMessage() {
  return 'Verification email is temporarily unavailable. Please try again shortly.';
}

async function getActiveChallengeStatus() {
  const requestUrl = resolveReporterAuthUrl('/api/reporter-auth/challenge-session');
  const res = await fetch(requestUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json().catch(() => null as any);
  return {
    requestUrl,
    res,
    data,
    code: getReporterResponseCode(data),
  };
}

export default function ReporterLoginPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, youthPulseSubmissionsClosed: false, updatedAt: null });
  const { session, reason } = useReporterPortalSession({ skipInitialCheck: true });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'code' | 'success'>('email');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [portalAvailable, setPortalAvailable] = useState<boolean | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<ReporterChallengeState | null>(null);
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const nextTarget = getSafeNextTarget(router.query.next);
  const latestRequestIdRef = useRef(0);
  const activeChallengeRef = useRef<ReporterChallengeState | null>(null);
  const sendInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);
  const pendingSendRequestRef = useRef<ReporterSendRequestState | null>(null);

  useEffect(() => {
    const storedProfile = loadReporterPortalProfile();
    if (storedProfile?.email) setEmail(storedProfile.email);
  }, []);

  useEffect(() => {
    fetchPublicSettings().then((settings) => {
      setPortalAvailable(Boolean(settings?.communityReporterEnabled && settings?.allowMyStoriesPortal));
    });
  }, []);

  useEffect(() => {
    if (session?.email) {
      router.replace(nextTarget).catch(() => {});
    }
  }, [nextTarget, router, session]);

  useEffect(() => {
    activeChallengeRef.current = activeChallenge;
  }, [activeChallenge]);

  const resetChallengeToEmailStep = (message: string, nextEmail?: string) => {
    logReporterAuthStateTransition(step, 'email', {
      reason: 'request_failure',
      hasMessage: Boolean(message),
      nextEmail: typeof nextEmail === 'string' && nextEmail ? nextEmail : null,
    });
    activeChallengeRef.current = null;
    setActiveChallenge(null);
    setCode('');
    setStep('email');
    setNotice(null);
    if (typeof nextEmail === 'string' && nextEmail) {
      setEmail(nextEmail);
    }
    setError(message);
  };

  const handleRequestCodeFailure = (message: string, nextEmail: string, options?: { resend?: boolean }) => {
    const shouldReturnToEmail = options?.resend || step !== 'email';
    if (shouldReturnToEmail) {
      resetChallengeToEmailStep(message, nextEmail);
      return;
    }
    setEmail(nextEmail);
    setError(message);
  };

  const sendVerificationCode = async (normalizedEmail: string, options?: { resend?: boolean }) => {
    if (sendInFlightRef.current) {
      logReporterAuthHandledFailure('request-code duplicate blocked', {
        url: resolveReporterAuthUrl('/api/reporter-auth/request-code'),
        email: normalizedEmail,
        requestId: pendingSendRequestRef.current?.requestId || null,
        duplicate: true,
        resend: Boolean(options?.resend),
      });
      return;
    }
    sendInFlightRef.current = true;
    const requestId = latestRequestIdRef.current + 1;
    const clientRequestId = `request-code-${requestId}-${Date.now()}`;
    latestRequestIdRef.current = requestId;
    pendingSendRequestRef.current = {
      requestId: clientRequestId,
      email: normalizedEmail,
      startedAt: Date.now(),
    };

    setError(null);
    setNotice(null);
    setIsSending(true);
    const requestUrl = resolveReporterAuthUrl('/api/reporter-auth/request-code');
    logReporterAuthEvent('request-code request', {
      url: requestUrl,
      credentialsIncluded: true,
      requestId,
      clientRequestId,
      duplicate: false,
      resend: Boolean(options?.resend),
    });
    try {
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Reporter-Request-Id': clientRequestId,
          'X-Reporter-Request-Duplicate': '0',
        },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => null as any);
      const responseCode = getReporterResponseCode(data);
      logReporterAuthEvent('request-code response', {
        url: requestUrl,
        status: res.status,
        ok: res.ok,
        parsedJson: {
          ok: data?.ok ?? null,
          code: data?.code ?? null,
          message: data?.message ?? null,
        },
        requestId,
        clientRequestId,
        resend: Boolean(options?.resend),
      });
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      if (!res.ok || data?.ok !== true) {
        logReporterAuthFailure('request-code failed', { url: requestUrl, status: res.status, backendCode: responseCode, credentialsIncluded: true, requestId, resend: Boolean(options?.resend) });
        const message = getRequestCodeErrorMessage(responseCode, res.status, data);
        if (shouldResetToEmailAfterRequestFailure(res.status, responseCode)) {
          handleRequestCodeFailure(message, normalizedEmail, options);
          return;
        }
        setEmail(normalizedEmail);
        setError(message);
        return;
      }

      logReporterAuthEvent('request-code success', { url: requestUrl, status: res.status, backendCode: responseCode, credentialsIncluded: true, requestId, resend: Boolean(options?.resend) });
      persistReporterIdentity(data, normalizedEmail);
      setEmail(normalizedEmail);
      setCode('');
      const nextChallenge = {
        requestId,
        email: normalizedEmail,
        expiresAt: typeof data?.expiresAt === 'string' ? data.expiresAt : null,
        debugCode: typeof data?.debugCode === 'string' ? data.debugCode : null,
        resendCount: options?.resend ? ((activeChallengeRef.current?.resendCount || 0) + 1) : 0,
      };
      activeChallengeRef.current = nextChallenge;
      setActiveChallenge(nextChallenge);
      logReporterAuthStateTransition(step, 'code', {
        reason: options?.resend ? 'request_code_resend_success' : 'request_code_success',
        requestId,
        resend: Boolean(options?.resend),
        status: res.status,
        backendOk: data?.ok === true,
      });
      setStep('code');
      setNotice(options?.resend ? 'A new verification code was sent. Use the most recent code only.' : 'Verification code sent. Check your email for the code or secure sign-in link.');
    } catch (requestError) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      logReporterAuthFailure('request-code request exception', {
        url: requestUrl,
        credentialsIncluded: true,
        requestId,
        resend: Boolean(options?.resend),
        error: requestError instanceof Error ? requestError.message : String(requestError),
      });
      handleRequestCodeFailure(getRequestCodeUnavailableMessage(), normalizedEmail, options);
    } finally {
      sendInFlightRef.current = false;
      pendingSendRequestRef.current = null;
      if (requestId === latestRequestIdRef.current) {
        setIsSending(false);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const verifyLink = async () => {
      setError(null);
      setNotice('Verifying your email login link…');
      setIsVerifying(true);
      const requestUrl = resolveReporterAuthUrl('/api/reporter-auth/verify-link');
      logReporterAuthEvent('verify-link request', { url: requestUrl });
      try {
        const res = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null as any);
        const responseCode = getReporterResponseCode(data);
        if (cancelled) return;
        if (!res.ok || data?.ok !== true || !data?.email) {
          logReporterAuthFailure('verify-link failed', { url: requestUrl, status: res.status, backendCode: responseCode });
          setError(responseCode === 'MAGIC_LINK_INVALID_OR_EXPIRED' ? 'This email login link is invalid or expired. Request a fresh code below.' : 'Could not verify this login link.');
          setNotice(null);
          setStep('email');
          return;
        }

        logReporterAuthEvent('verify-link success', { url: requestUrl, status: res.status, backendCode: responseCode, nextTarget });

        persistReporterIdentity(data, data.email);
        setStep('success');
        setNotice('Email verified. Opening Reporter Portal…');
        await router.replace(nextTarget);
      } finally {
        if (!cancelled) setIsVerifying(false);
      }
    };

    void verifyLink();
    return () => {
      cancelled = true;
    };
  }, [nextTarget, router, token]);

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return (
      <ReporterPortalLayout title="Reporter Portal" description="Reporter access is currently blocked by the Reporter Portal toggle." active="login">
        <PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so login and portal routes are blocked. Reporters can return to the public Community Reporter page for updates." actionHref="/community-reporter" actionLabel="Back to Community Reporter" />
      </ReporterPortalLayout>
    );
  }

  if (portalAvailable === false) {
    return (
      <ReporterPortalLayout title="Reporter Portal" description="Reporter access is currently unavailable." active="login">
        <PortalRouteState title="Reporter Portal is unavailable" description="Reporter login is disabled because the community reporter portal is not currently enabled in public settings." actionHref="/community-reporter" actionLabel="Back to Community Reporter" />
      </ReporterPortalLayout>
    );
  }

  return (
    <ReporterPortalLayout title="Reporter Portal Login" description="Use secure email verification to access your reporter dashboard, submissions, and profile." active="login" session={session}>
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">Login to Reporter Portal</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter your reporter email, receive a one-time verification code or secure email link, and finish sign-in before the portal opens.</p>

        {reason === 'SESSION_EXPIRED' ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your reporter session expired. Verify your email again to reopen the portal.</div> : null}
        {notice ? <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div> : null}

        {step === 'email' ? (
          <form className="mt-6 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (sendInFlightRef.current || isVerifying) {
              return;
            }
            setError(null);
            setNotice(null);
            const normalizedEmail = normalizeReporterEmail(email);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
              setError('Enter the same valid email address you use for community reporter submissions.');
              return;
            }
            await sendVerificationCode(normalizedEmail);
          }}>
            <div>
              <label htmlFor="reporterEmail" className="mb-1 block text-sm font-semibold text-slate-900">Reporter email</label>
              <input id="reporterEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-blue-500" placeholder="you@example.com" />
            </div>
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <button type="submit" disabled={isSending || isVerifying} className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ${(isSending || isVerifying) ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSending ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>
        ) : null}

        {step === 'code' ? (
          <form className="mt-6 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (verifyInFlightRef.current || sendInFlightRef.current) {
              return;
            }
            setError(null);
            setNotice(null);
            const currentChallenge = activeChallenge;
            const normalizedEmail = currentChallenge?.email || normalizeReporterEmail(email);
            const normalizedCode = String(code || '').trim();
            if (!currentChallenge) {
              setError('Request a new verification code to continue.');
              setStep('email');
              return;
            }
            if (normalizedCode.length < 6) {
              setError('Enter the 6-digit verification code from your email.');
              return;
            }

            verifyInFlightRef.current = true;
            setIsVerifying(true);
            const challengeStatus = await getActiveChallengeStatus();
            if (activeChallengeRef.current?.requestId !== currentChallenge.requestId) {
              return;
            }
            if (!challengeStatus.res.ok || challengeStatus.data?.ok !== true) {
              logReporterAuthHandledFailure('challenge-session failed before verify', { url: challengeStatus.requestUrl, status: challengeStatus.res.status, backendCode: challengeStatus.code, credentialsIncluded: true, requestId: currentChallenge.requestId });
              resetChallengeToEmailStep(getVerificationSessionExpiredMessage());
              return;
            }

            const requestUrl = resolveReporterAuthUrl('/api/reporter-auth/verify-code');
            logReporterAuthEvent('verify-code request', { url: requestUrl, backendCode: null, credentialsIncluded: true, requestId: currentChallenge.requestId });
            try {
              const res = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
              });
              const data = await res.json().catch(() => null as any);
              const responseCode = getReporterResponseCode(data);
              if (activeChallengeRef.current?.requestId !== currentChallenge.requestId) {
                return;
              }
              if (!res.ok || data?.ok !== true) {
                const failureDetails = { url: requestUrl, status: res.status, backendCode: responseCode, credentialsIncluded: true, requestId: currentChallenge.requestId };
                if (isExpectedReporterAuthFailure(res.status, responseCode, data)) {
                  logReporterAuthHandledFailure('verify-code failed', failureDetails);
                } else {
                  logReporterAuthFailure('verify-code failed', failureDetails);
                }
                if (isSessionExpiredCode(responseCode) || res.status === 401 || (res.status >= 500 && /SESSION|REPORTER_SESSION_MISSING/i.test(String(responseCode || data?.message || '')))) {
                  resetChallengeToEmailStep(getVerificationSessionExpiredMessage());
                  return;
                }
                const message = getVerifyCodeErrorMessage(responseCode, currentChallenge, { ...(data || {}), status: res.status });
                setError(message);
                if (responseCode === 'OTP_EXPIRED_OR_MISSING' || responseCode === 'REPORTER_OTP_EXPIRED' || responseCode === 'REPORTER_OTP_MISSING' || (typeof data?.attemptsRemaining === 'number' && data.attemptsRemaining <= 0)) {
                  setStep('email');
                  return;
                }
                return;
              }

              logReporterAuthEvent('verify-code success', { url: requestUrl, status: res.status, backendCode: responseCode, credentialsIncluded: true, requestId: currentChallenge.requestId });

              persistReporterIdentity(data, normalizedEmail);
              setStep('success');
              activeChallengeRef.current = null;
              setActiveChallenge(null);
              setNotice('Verification successful. Opening Reporter Portal…');
              await router.push(nextTarget);
            } finally {
              verifyInFlightRef.current = false;
              setIsVerifying(false);
            }
          }}>
            <div>
              <label htmlFor="reporterCode" className="mb-1 block text-sm font-semibold text-slate-900">Verification code</label>
              <input id="reporterCode" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 outline-none ring-0 focus:border-blue-500" placeholder="123456" />
              <p className="mt-2 text-xs text-slate-500">Code sent to {activeChallenge?.email || email}.{activeChallenge?.expiresAt ? ` Expires ${new Date(activeChallenge.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
              {activeChallenge?.debugCode ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Development code: {activeChallenge.debugCode}</p> : null}
            </div>
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <div className="flex gap-3">
              <button type="submit" disabled={isVerifying || isSending} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${(isVerifying || isSending) ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isVerifying ? 'Verifying code…' : 'Verify code'}
              </button>
              <button type="button" disabled={isSending || isVerifying} onClick={() => {
                if (!activeChallenge?.email) {
                  resetChallengeToEmailStep(getVerificationSessionExpiredMessage());
                  return;
                }
                void sendVerificationCode(activeChallenge.email, { resend: true });
              }} className={`rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 ${(isSending || isVerifying) ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'hover:bg-slate-50'}`}>
                {isSending ? 'Sending…' : 'Resend'}
              </button>
            </div>
          </form>
        ) : null}

        {step === 'success' ? <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Email verified. Opening your Reporter Portal session…</div> : null}
      </div>
    </ReporterPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;