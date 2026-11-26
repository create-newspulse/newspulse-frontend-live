import React, { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { authFailure, authText, reporterAuthRequest, type AuthCopyKey } from '../../lib/reporterAuthClient';
import type { ReporterPortalSession } from '../../lib/reporterPortal';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import { confirmedReporterEmailChange, reporterClientLock, reporterLifecycleStamp, signalReporterSessionInvalid } from '../../lib/reporterPrivacy';
import type { FeatureToggleProps } from '../../types/community-reporter';

const fields = ['fullName', 'phone', 'country', 'stateName', 'districtName', 'cityTownVillage'] as const;
type Form = Record<typeof fields[number], string>;
const emptyForm: Form = { fullName: '', phone: '', country: '', stateName: '', districtName: '', cityTownVillage: '' };
const input = 'mt-1 block w-full rounded-xl border border-slate-400 px-4 py-2';
const button = 'rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60';

function profileForm(raw: Partial<Form & ReporterPortalSession> | null | undefined, session: ReporterPortalSession): Form | null {
  if (!raw || raw.accountId !== session.accountId || raw.email !== session.email) return null;
  const result = { ...emptyForm };
  for (const key of fields) if (typeof raw[key] === 'string') result[key] = raw[key]!;
  return result;
}

function AccountProfile({ session }: { session: ReporterPortalSession }) {
  const router = useRouter();
  const t = (key: AuthCopyKey) => authText(router.locale, key);
  const [form, setForm] = useState<Form | null>(null);
  const [verifiedJournalist, setVerifiedJournalist] = useState(false);
  const [nextEmail, setNextEmail] = useState('');
  const [code, setCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [message, setMessage] = useState<AuthCopyKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [load, setLoad] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const { accountId, email } = session;

  useEffect(() => {
    const ac = new AbortController();
    controller.current = ac;
    const stamp = reporterLifecycleStamp();
    const current = () => !ac.signal.aborted && stamp === reporterLifecycleStamp() && !reporterClientLock();
    setMessage(null); setForm(null);
    void reporterAuthRequest('profile', 'GET', undefined, accountId, ac.signal).then(result => {
      if (!current()) return;
      if (result.status === 401 || result.status === 403 || result.data?.code === 'ACCOUNT_CHANGED') { signalReporterSessionInvalid(stamp); return; }
      const next = result.ok && profileForm(result.data.profile, { accountId, email });
      if (next) {
        setForm(next);
        setVerifiedJournalist(result.data.profile.verifiedJournalist === true);
      }
      else setMessage('unavailable');
    }, () => { if (current()) setMessage('unavailable'); });
    return () => { ac.abort(); };
  }, [accountId, email, load]);

  async function submit(action: 'save' | 'request' | 'confirm') {
    if (inFlight.current || !form || !controller.current || reporterClientLock()) return;
    const stamp = reporterLifecycleStamp();
    const signal = controller.current.signal;
    const current = () => !signal.aborted && stamp === reporterLifecycleStamp() && !reporterClientLock();
    const mailbox = nextEmail.trim().toLowerCase();
    if (action !== 'save' && mailbox === email) { setMessage('invalidEmail'); return; }
    inFlight.current = true;
    setBusy(true); setMessage(null);
    try {
      const result = await reporterAuthRequest(action === 'save' ? 'profile' : `profile/email/${action === 'request' ? 'request-change' : 'confirm-change'}`,
        action === 'save' ? 'PATCH' : 'POST', action === 'save' ? form : action === 'request' ? { email: mailbox } : { email: mailbox, code }, accountId, signal);
      if (!current()) return;
      if (result.status === 401 || result.status === 403 || result.data?.code === 'ACCOUNT_CHANGED') { signalReporterSessionInvalid(stamp); return; }
      if (!result.ok) { setMessage(authFailure(result.status, result.data?.code)); return; }
      if (action === 'save') {
        const saved = profileForm(result.data.profile, session);
        if (saved) {
          setForm(saved);
          setVerifiedJournalist(result.data.profile.verifiedJournalist === true);
        }
        setMessage(saved ? 'saved' : 'unavailable');
      } else if (action === 'request') {
        setAwaitingCode(true); setCode(''); setMessage('checkMail');
      } else if (result.data.reverifyRequired === true) {
        confirmedReporterEmailChange(stamp);
        await router.replace('/reporter/login?changed=1');
      } else {
        setMessage('unavailable');
      }
    } catch {
      if (current()) setMessage('unavailable');
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  }

  return <section className="mx-auto max-w-2xl space-y-6 rounded-xl bg-white p-6">
    {message && <p role="status">{t(message)}</p>}
    {!form ? message ? <button className={button} onClick={() => setLoad(n => n + 1)}>{t('retry')}</button> : <p role="status">{t('wait')}</p> : <>
      <p>{t('email')}: <bdi>{email}</bdi></p>
      <p>{t(verifiedJournalist ? 'verifiedJournalist' : 'noProfessionalVerification')}</p>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit('save'); }}>
        {fields.map(key => <label key={key}>{t(key)}<input className={input} autoComplete="off" type={key === 'phone' ? 'tel' : 'text'} maxLength={256}
          required={key === 'fullName'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <button className={button} disabled={busy}>{t('save')}</button>
      </form>
      <hr />
      <h2 className="text-xl font-bold">{t('changeEmail')}</h2><p>{t('changeHelp')}</p>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(awaitingCode ? 'confirm' : 'request'); }}>
        <label className="block">{t('newEmail')}<input className={input} type="email" required autoComplete="off" maxLength={254}
          readOnly={awaitingCode || busy} value={nextEmail} onChange={e => setNextEmail(e.target.value)} /></label>
        {awaitingCode && <label className="block">{t('code')}<input className={input} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>}
        <button className={button} disabled={busy}>{t(awaitingCode ? 'confirmEmail' : 'send')}</button>
        {awaitingCode && <button className="ml-4" type="button" disabled={busy} onClick={() => { setAwaitingCode(false); setCode(''); setMessage(null); }}>{t('resend')}</button>}
      </form>
    </>}
  </section>;
}

export default function ReporterProfilePage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const t = (key: AuthCopyKey) => authText(router.locale, key);
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed });
  const { session, status, reason, logout } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const closed = toggles.communityReporterClosed || toggles.reporterPortalClosed;
  useEffect(() => {
    if (status === 'anonymous' && !closed && reason !== 'LOGOUT_UNCONFIRMED' && reporterClientLock() !== 'signed-out') {
      void router.replace('/reporter/login?next=%2Freporter%2Fprofile');
    }
  }, [status, closed, reason, router]);
  const handleLogout = async () => {
    if (await logout()) await router.replace('/reporter/login');
  };
  return <ReporterPortalLayout title={t('profile')} description={t('manage')} active="profile" session={closed ? null : session}
    onLogout={session && !closed ? handleLogout : undefined}>
    {reason === 'LOGOUT_UNCONFIRMED' ? <div role="alert"><p>{t('logoutPending')}</p><button className={button} onClick={() => void handleLogout()}>{t('retryLogout')}</button></div>
      : closed ? <PortalRouteState title={t('closed')} description={t('unavailable')} actionHref="/community-reporter" actionLabel={t('back')} />
      : status === 'authenticated' && session ? <AccountProfile key={session.accountId} session={session} />
      : status === 'anonymous' ? <PortalRouteState title={t('login')} description={t('instructions')} actionHref="/reporter/login" actionLabel={t('login')} />
      : <p role="status">{t('wait')}</p>}
  </ReporterPortalLayout>;
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store');
  return getReporterPortalPageServerProps(ctx);
};
