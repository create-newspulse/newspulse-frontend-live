import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { fetchPublicSettings } from '../../lib/communityReporterApi';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import { loadReporterPortalProfile, normalizeReporterEmail, saveReporterPortalProfile } from '../../lib/reporterPortal';
import type { FeatureToggleProps } from '../../types/community-reporter';

const DEFAULT_PORTAL_TARGET = '/reporter/dashboard';

function getSafeNextTarget(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/reporter/')) {
    return DEFAULT_PORTAL_TARGET;
  }
  return candidate;
}

export default function ReporterLoginPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, updatedAt: null });
  const { session, reason } = useReporterPortalSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'code' | 'success'>('email');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [portalAvailable, setPortalAvailable] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const nextTarget = getSafeNextTarget(router.query.next);

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
    if (!token) return;
    let cancelled = false;

    const verifyLink = async () => {
      setError(null);
      setNotice('Verifying your email login link…');
      setIsVerifying(true);
      try {
        const res = await fetch('/api/reporter-auth/verify-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null as any);
        if (cancelled) return;
        if (!res.ok || data?.ok !== true || !data?.email) {
          setError(data?.message === 'MAGIC_LINK_INVALID_OR_EXPIRED' ? 'This email login link is invalid or expired. Request a fresh code below.' : 'Could not verify this login link.');
          setNotice(null);
          setStep('email');
          return;
        }

        saveReporterPortalProfile({ ...(loadReporterPortalProfile() || {}), email: data.email });
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
            setError(null);
            setNotice(null);
            const normalizedEmail = normalizeReporterEmail(email);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
              setError('Enter the same valid email address you use for community reporter submissions.');
              return;
            }
            setIsSending(true);
            try {
              const res = await fetch('/api/reporter-auth/request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email: normalizedEmail }),
              });
              const data = await res.json().catch(() => null as any);
              if (!res.ok || data?.ok !== true) {
                if (data?.message === 'REPORTER_PORTAL_EMAIL_NOT_CONFIGURED') {
                  setError('Reporter email verification is not configured yet on this environment.');
                  return;
                }
                if (res.status === 503) {
                  setError('Verification email is temporarily unavailable. Please try again shortly.');
                  return;
                }
                setError('Could not send a verification code right now.');
                return;
              }
              saveReporterPortalProfile({ ...(loadReporterPortalProfile() || {}), email: normalizedEmail });
              setEmail(normalizedEmail);
              setExpiresAt(typeof data?.expiresAt === 'string' ? data.expiresAt : null);
              setDebugCode(typeof data?.debugCode === 'string' ? data.debugCode : null);
              setNotice('Verification code sent. Check your email for the code or secure sign-in link.');
              setStep('code');
            } finally {
              setIsSending(false);
            }
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
            setError(null);
            setNotice(null);
            const normalizedEmail = normalizeReporterEmail(email);
            const normalizedCode = String(code || '').trim();
            if (normalizedCode.length < 6) {
              setError('Enter the 6-digit verification code from your email.');
              return;
            }

            setIsVerifying(true);
            try {
              const res = await fetch('/api/reporter-auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
              });
              const data = await res.json().catch(() => null as any);
              if (!res.ok || data?.ok !== true) {
                if (data?.message === 'OTP_EXPIRED_OR_MISSING') {
                  setError('This verification code expired. Request a fresh code.');
                  setStep('email');
                  return;
                }
                if (data?.message === 'OTP_INVALID') {
                  setError(`Invalid code.${typeof data?.attemptsRemaining === 'number' ? ` Attempts remaining: ${data.attemptsRemaining}.` : ''}`);
                  return;
                }
                setError('Could not verify this code.');
                return;
              }

              saveReporterPortalProfile({ ...(loadReporterPortalProfile() || {}), email: normalizedEmail });
              setStep('success');
              setNotice('Verification successful. Opening Reporter Portal…');
              await router.push(nextTarget);
            } finally {
              setIsVerifying(false);
            }
          }}>
            <div>
              <label htmlFor="reporterCode" className="mb-1 block text-sm font-semibold text-slate-900">Verification code</label>
              <input id="reporterCode" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 outline-none ring-0 focus:border-blue-500" placeholder="123456" />
              <p className="mt-2 text-xs text-slate-500">Code sent to {email}.{expiresAt ? ` Expires ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
              {debugCode ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Development code: {debugCode}</p> : null}
            </div>
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <div className="flex gap-3">
              <button type="submit" disabled={isVerifying} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${isVerifying ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isVerifying ? 'Verifying code…' : 'Verify code'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null); setNotice(null); }} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Resend
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