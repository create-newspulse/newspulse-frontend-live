import React, { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { fetchPublicSettings } from '../../lib/communityReporterApi';
import { authFailure, authText, reporterAuthRequest, type AuthCopyKey } from '../../lib/reporterAuthClient';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import { REPORTER_PRIVATE_RESET, reporterClientLock, reporterLifecycleStamp, verifiedReporterLogin } from '../../lib/reporterPrivacy';
import type { FeatureToggleProps } from '../../types/community-reporter';

const input = 'mt-1 w-full rounded-xl border border-slate-400 px-4 py-2';
const button = 'rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60';

function safeNext(value: unknown) {
  return typeof value === 'string' && /^\/reporter\/(?:dashboard|profile|submit(?:\?draft=[a-f0-9]{24})?|submissions(?:\/[a-z0-9-]+(?:\/edit)?)?)$/i.test(value)
    ? value : '/reporter/dashboard';
}

export default function ReporterLoginPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const t = (key: AuthCopyKey) => authText(router.locale, key);
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed });
  const { session, reason, logout, bootstrapSession } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [message, setMessage] = useState<AuthCopyKey | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const submittingLogin = useRef(false);
  const next = safeNext(router.query.next);
  const closed = toggles.communityReporterClosed || toggles.reporterPortalClosed;
  const retry = reason === 'LOGOUT_UNCONFIRMED' || message === 'logoutPending';

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void fetchPublicSettings().then(settings => {
      if (!cancelled) setEnabled(!!settings?.communityReporterEnabled && !!settings.allowMyStoriesPortal);
    }, () => { if (!cancelled) setEnabled(false); });
    const reset = () => {
      generation.current++;
      setEmail(''); setCode(''); setChallenge(null); setMessage(null);
    };
    window.addEventListener(REPORTER_PRIVATE_RESET, reset);
    return () => { mounted.current = false; cancelled = true; window.removeEventListener(REPORTER_PRIVATE_RESET, reset); };
  }, []);

  useEffect(() => {
    if (session && !closed && enabled && !retry && !submittingLogin.current && !reporterClientLock()) void router.replace(next);
  }, [session, closed, enabled, retry, next, router]);

  async function run(action: 'request' | 'verify' | 'logout') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    const stamp = reporterLifecycleStamp();
    const version = generation.current;
    const current = () => mounted.current && stamp === reporterLifecycleStamp() && version === generation.current;
    try {
      if (action === 'logout') {
        const confirmed = await logout();
        if (mounted.current) setMessage(confirmed ? 'signedOut' : 'logoutPending');
        return;
      }
      if (!enabled || closed) return;
      const mailbox = email.trim().toLowerCase();
      if (action === 'request') {
        const result = await reporterAuthRequest('request-code', 'POST', { email: mailbox });
        if (!current()) return;
        setCode('');
        if (result.ok) { setChallenge(stamp); setMessage('checkMail'); }
        else { setChallenge(null); setMessage(authFailure(result.status, result.data?.code)); }
        return;
      }
      if (challenge !== stamp) { setChallenge(null); setMessage('unconfirmed'); return; }
      submittingLogin.current = true;
      const result = await reporterAuthRequest('verify-code', 'POST', { email: mailbox, code });
      if (!current()) return;
      setCode('');
      if (!result.ok || typeof result.data?.accountId !== 'string') {
        setMessage(authFailure(result.status, result.data?.code)); return;
      }
      if (!verifiedReporterLogin(stamp)) return;
      const verified = await bootstrapSession();
      if (!mounted.current || reporterClientLock()) return;
      if (verified.status !== 'authenticated' || verified.session.email !== mailbox || verified.session.accountId !== result.data.accountId) {
        // Never navigate with a previous account's still-valid cookie.
        if (verified.status === 'authenticated') {
          const confirmed = await logout();
          if (!confirmed) { if (mounted.current) setMessage('logoutPending'); return; }
        }
        setMessage('unconfirmed'); return;
      }
      await router.replace(next);
    } catch {
      if (mounted.current) setMessage('unavailable');
    } finally {
      submittingLogin.current = false;
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <ReporterPortalLayout title={t('login')} description={t('instructions')} active="login">
    {retry ? <section className="mx-auto max-w-xl space-y-4 rounded-xl bg-white p-6">
      <p role="alert">{t('logoutPending')}</p>
      <button className={button} disabled={busy} onClick={() => void run('logout')}>{t('retryLogout')}</button>
    </section> : closed || enabled === false ? <PortalRouteState title={t('closed')} description={t('unavailable')} actionHref="/community-reporter" actionLabel={t('back')} />
      : enabled === null ? <p role="status">{t('wait')}</p> : <section className="mx-auto max-w-xl space-y-4 rounded-xl bg-white p-6">
        {reason === 'SESSION_EXPIRED' ? <p role="status">{t('expired')}</p> : null}
        {router.query.changed === '1' ? <p role="status">{t('emailChanged')}</p> : null}
        {message ? <p role="status">{t(message)}</p> : null}
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(challenge === null ? 'request' : 'verify'); }}>
          {challenge === null
            ? <label className="block">{t('email')}<input className={input} type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
            : <label className="block">{t('code')}<input className={input} required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>}
          <button className={button} disabled={busy}>{t(busy ? 'wait' : challenge === null ? 'send' : 'verify')}</button>
          {challenge !== null ? <div className="flex flex-wrap gap-4">
            <button type="button" disabled={busy} onClick={() => void run('request')}>{t('resend')}</button>
            <button type="button" disabled={busy} onClick={() => { setChallenge(null); setCode(''); setEmail(''); setMessage(null); }}>{t('another')}</button>
          </div> : null}
        </form>
      </section>}
  </ReporterPortalLayout>;
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store');
  return getReporterPortalPageServerProps(ctx);
};
