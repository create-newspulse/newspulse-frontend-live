import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { COMMUNITY_REPORTER_CATEGORY_OPTIONS } from '../../lib/communityReporterCategories';
import { ageGroups, intakeCategory, scopes, storyLanguage, storyLanguages, validContactNumber, validEmail, type AgeGroup, type Scope, type StoryLanguage } from '../../lib/communityReporterIntake';
import { reporterStatusText } from '../../lib/reporterCopy';
import { removeReporterStorageKeys, REPORTER_PRIVATE_RESET, signalReporterSessionInvalid } from '../../lib/reporterPrivacy';
import { record, reporterObjectId, type ReporterStory } from '../../lib/reporterStories';
import { createReporterDraft, openReporterDraft, patchReporterDraft, prepareFirstDraft, submitCommunityStory,
  type DraftResult, type FirstDraftAttempt, type IntakeFailure, type SubmitCommunityStoryResult } from '../../src/lib/communityReporterApi';
import type { CommunitySettingsPublic, FeatureToggleProps } from '../../types/community-reporter';
import { usePublicMode } from '../../utils/PublicModeProvider';
import { intakeText, optionText, type IntakeKey } from './intakeCopy';

type Props = FeatureToggleProps & { variant?: 'public' | 'portal'; draftId?: string | null };
type Actor = { kind: 'guest' } | { kind: 'account'; accountId: string; email: string; name: string };
const guest: Actor = { kind: 'guest' };
const tracks = '/reporter/submissions';
const login = '/reporter/login';
const linkClass = 'font-semibold text-blue-700 underline dark:text-blue-300';
const box = 'mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8';
const button = 'rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'rounded-lg border border-gray-400 px-4 py-2 font-semibold focus-visible:ring-2 disabled:opacity-50';
const field = 'mt-1 block w-full min-w-0 rounded-lg border border-gray-400 bg-white px-3 py-2 dark:bg-gray-900';
const interests = ['Local issues', 'Youth', 'Politics', 'Civic', 'Education', 'Health', 'Environment', 'Sports', 'Culture'];
const labelFor = (locale: string | undefined) => (key: IntakeKey) => intakeText(locale, key);

function useIntakeSettings() {
  const [settings, setSettings] = useState<CommunitySettingsPublic | 'loading' | null>('loading');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 6_000);
    setSettings('loading');
    void (async () => {
      try {
        const res = await fetch('/api/public/community/settings', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
        const data: unknown = await res.json();
        const s = record(data) && record(data.settings) && data.ok === true ? data.settings : null;
        if (!res.ok || !s || typeof s.communityReporterEnabled !== 'boolean' || typeof s.allowNewSubmissions !== 'boolean'
          || typeof s.allowMyStoriesPortal !== 'boolean' || typeof s.allowJournalistApplications !== 'boolean') throw new Error();
        if (active) setSettings({ communityReporterEnabled: s.communityReporterEnabled, allowNewSubmissions: s.allowNewSubmissions,
          allowMyStoriesPortal: s.allowMyStoriesPortal, allowJournalistApplications: s.allowJournalistApplications });
      } catch { if (active) setSettings(null); }
      finally { clearTimeout(deadline); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(deadline); };
  }, [attempt]);
  return { settings, retry: () => retry(i => i + 1) };
}

export default function SubmissionExperience({ variant = 'public', draftId = null, communityReporterClosed, reporterPortalClosed }: Props) {
  const router = useRouter();
  const t = labelFor(router.locale);
  const portal = variant === 'portal';
  const { readOnly, mode, isLoading: modeLoading } = usePublicMode();
  const initial = useMemo(() => ({ communityReporterClosed, reporterPortalClosed, youthPulseSubmissionsClosed: false, updatedAt: null }),
    [communityReporterClosed, reporterPortalClosed]);
  const { toggles } = usePublicFounderToggles(initial);
  const { settings, retry } = useIntakeSettings();
  const { session, status, reason, bootstrapSession, logout } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const [generation, setGeneration] = useState(0);
  const [startGuest, setStartGuest] = useState(false);
  const [invalidated, setInvalidated] = useState(false);
  const hadAccount = useRef(false);
  const confirmed = status === 'authenticated' && session && reporterObjectId(session.accountId) && validEmail(session.email);
  const verified: Actor | null = useMemo(() => confirmed && session
    ? { kind: 'account', accountId: session.accountId, email: session.email.toLowerCase(), name: session.fullName || session.name || '' }
    : null, [confirmed, session?.accountId, session?.email, session?.fullName, session?.name]);
  const [lastActor, setLastActor] = useState<Actor | null>(null);
  const signedOut = status === 'anonymous' && (!reason || reason === 'REPORTER_SESSION_MISSING' || reason === 'SESSION_EXPIRED');
  const guestAllowed = !portal && !invalidated && (startGuest || (signedOut && !hadAccount.current));
  useEffect(() => {
    if (verified) { hadAccount.current = true; setStartGuest(false); setLastActor(verified); }
    else if (status !== 'checking') setLastActor(guestAllowed ? guest : null);
  }, [verified, guestAllowed, status]);
  useEffect(() => {
    removeReporterStorageKeys();
    const reset = () => { setLastActor(null); setGeneration(i => i + 1); setStartGuest(false); };
    window.addEventListener(REPORTER_PRIVATE_RESET, reset);
    return () => window.removeEventListener(REPORTER_PRIVATE_RESET, reset);
  }, []);
  const invalidate = useCallback(() => {
    setInvalidated(true);
    signalReporterSessionInvalid();
  }, []);

  const portalOpen = !toggles.reporterPortalClosed && settings !== 'loading' && !!settings?.allowMyStoriesPortal;
  const closed = toggles.communityReporterClosed || (settings !== 'loading' && settings?.communityReporterEnabled === false)
    || ((portal || !!verified || (status === 'checking' && lastActor?.kind === 'account'))
      && (toggles.reporterPortalClosed || (settings !== 'loading' && settings?.allowMyStoriesPortal === false)));
  const paused = readOnly || mode !== 'NORMAL' || modeLoading || (settings !== 'loading' && !settings?.allowNewSubmissions);
  const checking = status === 'checking';
  // If identity changes, React unmounts all fields and pending results in the same render.
  // An inconclusive check can suspend an existing account form, but cannot turn it into a guest POST.
  const actor = verified || (checking ? lastActor : null) || (guestAllowed ? guest : null);
  const currentHref = `/reporter/submit${draftId === null ? '' : `?draft=${encodeURIComponent(draftId)}`}`;
  const loginHref = `${login}?next=${encodeURIComponent(portal ? currentHref : tracks)}`;
  useEffect(() => {
    if (portal && portalOpen && !closed && signedOut && !invalidated) void router.replace(loginHref).catch(() => {});
  }, [closed, invalidated, loginHref, portal, portalOpen, router, signedOut]);

  const title = t(portal ? 'portalTitle' : 'title');
  const trackHref = verified ? tracks : `${login}?next=${encodeURIComponent(tracks)}`;
  const mayStartGuest = !portal && !verified && !checking && reason !== 'LOGOUT_UNCONFIRMED';
  return <div className="min-h-screen bg-white text-gray-950 dark:bg-dark-primary dark:text-gray-100">
    <Head><title>{title} | News Pulse</title><meta name="description" content={t('intro')} /></Head>
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-10 dark:from-gray-800 dark:to-gray-900">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-black sm:text-5xl">{title}</h1>
        <p className="max-w-3xl text-lg leading-relaxed">{t('intro')}</p>
        <nav aria-label={title} className="flex flex-wrap gap-x-5 gap-y-2">
          {portalOpen && <><Link className={linkClass} href={verified ? '/reporter/dashboard' : loginHref}>{t(verified ? 'dashboard' : 'login')}</Link>
            <Link className={linkClass} href={trackHref}>{t('track')}</Link></>}
          {!closed && <Link className={linkClass} href="#submit-form">{t('submit')}</Link>}
        </nav>
        <aside className="rounded-xl bg-white p-4 dark:bg-gray-800">
          <h2 className="font-bold">{t('guidelines')}</h2>
          <ul className="my-2 list-disc space-y-1 pl-5 text-sm"><li>{t('guideline1')}</li><li>{t('guideline2')}</li></ul>
          <Link className={linkClass} href="/community-reporter/guidelines">{t('guide')}</Link>
        </aside>
      </div>
    </section>
    <section id="submit-form" className="px-4 py-8">
      <div className={box}>
        {closed ? <p role="status">{t('closed')}</p> : settings === 'loading' ? <p role="status">{t('loading')}</p>
          : !settings ? <><p role="alert">{t('unavailable')}</p><button type="button" className={secondary} onClick={retry}>{t('retryRead')}</button></>
          : !actor || invalidated ? <>
              <p role="status">{t(checking ? 'checking' : invalidated || signedOut ? 'session' : 'sessionUnknown')}</p>
              {!checking && <div className="mt-3 flex flex-wrap gap-3">
                {(portalOpen || reason === 'LOGOUT_UNCONFIRMED') && <Link href={loginHref} className={linkClass}>{t(reason === 'LOGOUT_UNCONFIRMED' ? 'finishLogout' : 'login')}</Link>}
                {!signedOut && <button type="button" className={secondary} onClick={() => { setInvalidated(false); void bootstrapSession(); }}>{t('retryRead')}</button>}
                {mayStartGuest && <button type="button" className={secondary} onClick={async () => {
                  if (await logout()) { setInvalidated(false); setStartGuest(true); }
                }}>{t('newGuest')}</button>}
              </div>}
            </>
          : <>
              {paused && <p role="status" className="mb-4 rounded-lg bg-amber-100 p-3 text-amber-950">{t('paused')}</p>}
              {checking && <p role="status">{t('checking')}</p>}
              <div hidden={checking}><ScopedSubmission key={JSON.stringify([generation, actor.kind, actor.kind === 'account' && [actor.accountId, actor.email], draftId])}
                actor={actor} locale={router.locale} draftId={draftId} disabled={paused || checking}
                journalistOpen={settings.allowJournalistApplications} portalOpen={portalOpen} invalidate={invalidate} /></div>
            </>}
      </div>
    </section>
  </div>;
}

type FormProps = { actor: Actor; locale?: string; draftId: string | null; disabled: boolean; journalistOpen: boolean; portalOpen: boolean; invalidate: () => void };
type FormState = ReturnType<typeof blank>;
const blank = (actor: Actor, locale?: string) => ({
  fullName: actor.kind === 'account' ? actor.name : '', email: actor.kind === 'account' ? actor.email : '',
  phone: '', whatsapp: '', city: '', district: '', state: '', country: actor.kind === 'guest' ? intakeText(locale, 'india') : '', beats: [] as string[],
  reporterType: 'community' as 'community' | 'journalist', contact: false, ethics: false,
  age: '' as AgeGroup | '', scope: '' as Scope | '', headline: '', story: '', category: '', language: '' as StoryLanguage | '',
});

function ScopedSubmission({ actor, locale, draftId, disabled, journalistOpen, portalOpen, invalidate }: FormProps) {
  const t = labelFor(locale);
  const [draft, setDraft] = useState<ReporterStory | null>(null);
  const editing = draftId !== null || draft !== null;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [form, setForm] = useState(() => blank(actor, locale));
  const [step, setStep] = useState<1 | 2>(editing ? 2 : 1);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, IntakeKey>>>({});
  const [issue, setIssue] = useState<IntakeFailure | 'partial' | 'draftUncertain' | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; final: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [checked, setChecked] = useState(false);
  const [editedAfterValidation, setEditedAfterValidation] = useState(true);
  const locked = useRef(false);
  const confirmedDraftId = useRef(draftId);
  const firstSave = useRef<FirstDraftAttempt | null>(null);
  const active = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const accountId = actor.kind === 'account' ? actor.accountId : '';
  const firstHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    active.current = true;
    const stop = () => { active.current = false; firstSave.current = null; };
    window.addEventListener(REPORTER_PRIVATE_RESET, stop);
    return () => { stop(); window.removeEventListener(REPORTER_PRIVATE_RESET, stop); };
  }, []);
  useEffect(() => {
    if (draftId === null) return;
    let current = true;
    const controller = new AbortController();
    void openReporterDraft(draftId, accountId, controller.signal).then(result => {
      if (!current || !active.current) return;
      if (!result.ok) {
        if (result.reason === 'session') invalidate();
        else setIssue(result.reason === 'notEditable' ? 'notEditable' : 'unavailable');
        return;
      }
      setIssue(null); setDraft(result.item);
      setForm(value => ({ ...value, headline: result.item.headline, story: result.item.story,
        category: intakeCategory(result.item.category)?.value || '', language: result.item.originalLanguage || '' }));
    });
    return () => { current = false; controller.abort(); };
  }, [draftId, accountId, loadAttempt, invalidate]);

  const uncertain = issue === 'uncertain' || issue === 'partial';
  const freeze = disabled || busy || uncertain || issue === 'draftUncertain' || issue === 'draftConflict' || issue === 'notEditable' || !!receipt?.final;
  const dirty = draft ? form.headline.trim() !== draft.headline || form.story.trim() !== draft.story || (intakeCategory(form.category)?.label ?? null) !== draft.category
    || (form.language || null) !== draft.originalLanguage : !!(form.headline.trim() || form.story.trim());
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (freeze) return;
    setForm(old => ({ ...old, [key]: value }));
    setErrors(old => ({ ...old, [key]: undefined }));
    setEditedAfterValidation(true); setChecked(false); setIssue(null); setReceipt(null);
  }
  function invalid(next: typeof errors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    return !!first;
  }
  function next() {
    const err: typeof errors = {};
    if (actor.kind === 'guest' && !form.fullName.trim()) err.fullName = 'nameError';
    if (!validEmail(form.email.trim())) err.email = 'emailError';
    if (!validContactNumber(form.phone.trim())) err.phone = 'phoneError';
    if (!validContactNumber(form.whatsapp.trim())) err.whatsapp = 'phoneError';
    if (actor.kind === 'guest' && !form.ethics) err.ethics = 'ethicsError';
    if (!invalid(err)) { setStep(2); firstHeading.current?.focus(); }
  }
  async function send(action: 'submit' | 'draft', replay = false) {
    const retry = replay && action === 'draft' && issue === 'draftUncertain' && firstSave.current && !editing && !disabled && !busy;
    if (!active.current || (freeze && !retry) || locked.current || (!editing && confirmedDraftId.current !== null)
      || !editedAfterValidation || (editing && (!draft || !accountId))
      || (action === 'draft' && (!accountId || !dirty))) return;
    const err: typeof errors = {};
    const headline = form.headline.trim(), story = form.story.trim();
    if ((action === 'submit' || form.category) && !intakeCategory(form.category)) err.category = 'chooseCategory';
    if (action === 'submit' && !form.ethics) err.ethics = 'ethicsError';
    if (editing || action === 'draft') {
      const complete = action === 'submit' || draft?.reviewStatus === 'NEEDS_REVISION';
      if (headline.length > 200 || (complete && !headline)) err.headline = 'editHeadlineError';
      if (story.length > 50_000 || (complete && !story)) err.story = 'editStoryError';
      if (action === 'draft' && !headline && !story) err.headline = 'draftError';
    } else {
      if (!headline || headline.length > 150) err.headline = 'headlineError';
      if (story.length < 50 || story.length > 10_000) err.story = 'storyError';
      if (actor.kind === 'guest' && !form.age) err.age = 'chooseAge';
      if (actor.kind === 'account' && !form.scope) err.scope = 'scopeError';
    }
    if (invalid(err)) return;
    locked.current = true; setBusy(true); setChecked(false); setReceipt(null); setIssue(null);
    const originalLanguage = storyLanguage(form.language) && (!editing || form.language !== draft?.originalLanguage) ? form.language : undefined;
    try {
      const article = { headline, story, ...(form.category ? { category: form.category } : {}), ...(originalLanguage ? { originalLanguage } : {}) };
      const location = { city: form.city.trim(), district: form.district.trim(), state: form.state.trim(), country: form.country.trim() };
      let result: SubmitCommunityStoryResult | DraftResult;
      if (editing) {
        result = await patchReporterDraft(draft!, accountId, { ...article, action, ...(action === 'submit' ? { generalEthicsAccepted: form.ethics } : {}) });
      } else if (action === 'draft') {
        const attempt = retry ? firstSave.current! : prepareFirstDraft(accountId, { ...article, ...location, action, phone: form.phone,
          whatsapp: form.whatsapp, coverageScope: form.scope, beat: form.beats.join(', ') }, firstSave.current);
        if ('ok' in attempt) result = attempt;
        else { firstSave.current = attempt; result = await createReporterDraft(accountId, attempt); }
      } else {
        result = await submitCommunityStory({
            ...article, ...location, category: form.category, reporterEmail: form.email.trim().toLowerCase(), reporterPhone: form.phone.trim(), generalEthicsAccepted: form.ethics,
            ...(actor.kind === 'guest'
              ? { reporterName: form.fullName.trim(), consentToContact: form.contact, ageGroup: form.age as AgeGroup }
              : { reporterWhatsApp: form.whatsapp.trim(), coverageScope: form.scope as Scope, communityInterests: form.beats }),
          }, actor);
      }
      if (!active.current) return;
      if (!result.ok) {
        if (result.reason === 'session') { invalidate(); return; }
        const unconfirmedCreate = !editing && action === 'draft' && (result.reason === 'uncertain' || (retry && result.reason !== 'draftConflict' && result.reason !== 'notEditable'));
        setIssue(unconfirmedCreate ? 'draftUncertain' : result.reason === 'uncertain' && action === 'draft' && (!headline || !story) ? 'partial' : result.reason);
        if (result.reason === 'validation' && !unconfirmedCreate) setEditedAfterValidation(false);
        locked.current = !unconfirmedCreate && (result.reason === 'uncertain' || result.reason === 'notEditable' || result.reason === 'draftConflict');
      } else if ('item' in result) {
        confirmedDraftId.current = result.item.id;
        firstSave.current = null; setForm(old => ({ ...old, ethics: false }));
        setDraft(result.item); setReceipt({ id: result.item.id, final: action === 'submit' });
        locked.current = action === 'submit';
      } else {
        setForm(blank(actor, locale)); setReceipt({ id: result.referenceId, final: true });
      }
    } catch {
      if (active.current) {
        const keyed = !editing && action === 'draft' && !!firstSave.current;
        locked.current = !keyed;
        setIssue(keyed ? 'draftUncertain' : 'uncertain');
      }
    }
    finally { if (active.current) setBusy(false); }
  }
  async function reconcile() {
    if (!draft || !accountId || !uncertain || reconciling || disabled) return;
    setReconciling(true);
    const result = await openReporterDraft(draft.id, accountId, new AbortController().signal);
    if (!active.current) return;
    setReconciling(false);
    if (!result.ok) {
      if (result.reason === 'session') invalidate();
      else if (result.reason === 'notEditable') setIssue('notEditable');
      return;
    }
    // This read is not a write receipt. Keep the reporter's unsent text.
    setDraft(result.item); setIssue(null); setChecked(true); locked.current = false;
  }
  const errorMessage = (key: keyof FormState) => errors[key] ? <p id={`error-${key}`} className="mt-1 text-sm text-red-700 dark:text-red-300" role="alert">{t(errors[key]!)}</p> : null;
  const aria = (key: keyof FormState) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `error-${key}` : undefined });
  const input = (key: 'fullName' | 'email' | 'phone' | 'whatsapp' | 'city' | 'district' | 'state' | 'country' | 'headline', label: IntakeKey, type = 'text', required = false) =>
    <div key={key}><label htmlFor={`intake-${key}`} className="font-medium">{t(label)}{required ? ' *' : ''}</label>
      <input className={field} id={`intake-${key}`} name={key} type={type} value={form[key]} required={required && !(accountId && key === 'headline')}
        maxLength={key === 'headline' ? (accountId ? 200 : 150) : undefined} readOnly={actor.kind === 'account' && (key === 'email' || key === 'fullName')}
        {...aria(key)} onChange={e => update(key, e.target.value)} />{errorMessage(key)}</div>;
  const chip = (value: string, label: string) => <button key={value} type="button" aria-pressed={form.beats.includes(value)}
    className={`rounded-full border px-3 py-1.5 ${form.beats.includes(value) ? 'bg-blue-700 text-white' : ''}`} onClick={() =>
      update('beats', form.beats.includes(value) ? form.beats.filter(v => v !== value) : [...form.beats, value])}>{label}</button>;
  const ethics = <div><label className="flex items-start gap-3"><input type="checkbox" name="ethics" className="mt-1" required={!accountId} checked={form.ethics} {...aria('ethics')}
    onChange={e => update('ethics', e.target.checked)} />{t('ethics')} *</label>{errorMessage('ethics')}</div>;
  const receiptBox = receipt && <div role="status" className="space-y-2 rounded-xl bg-green-50 p-4 text-green-950">
    <strong>{t(receipt.final ? 'received' : 'saved')}</strong>
    <p className="break-all">{t('reference')}: <bdi>{receipt.id}</bdi></p>
    {!receipt.final && draft && <><p>{t('status')}: {reporterStatusText(locale, draft.reviewStatus)}</p>
      {draft.reviewStatus === 'DRAFT' && <Link className={linkClass} href={`/reporter/submit?draft=${draft.id}`}>{t('editDraft')}</Link>}</>}
    {portalOpen && <Link className={linkClass} href={actor.kind === 'account' ? tracks : login}>{t(actor.kind === 'account' ? 'track' : 'login')}</Link>}
  </div>;
  if (receipt?.final) return <div className="space-y-4">{receiptBox}
    {!editing && <button className={secondary} type="button" disabled={disabled} onClick={() => { if (disabled) return; locked.current = false; setReceipt(null); setStep(1); }}>{t('another')}</button>}</div>;
  if (editing && !draft) return <div className="space-y-3"><h2 className="text-xl font-bold">{t('edit')}</h2>
    <p role={issue ? 'alert' : 'status'}>{t(issue === 'notEditable' ? 'notEditable' : issue ? 'unavailable' : 'opening')}</p>
    {issue && issue !== 'notEditable' && <button className={secondary} type="button" onClick={() => { setIssue(null); setLoadAttempt(n => n + 1); }}>{t('retryRead')}</button>}
    <Link className={linkClass} href={tracks}>{t('track')}</Link></div>;
  return <form ref={formRef} noValidate autoComplete="off" onSubmit={event => {
    event.preventDefault();
    if (freeze || locked.current) return;
    if (step === 1) next();
    else {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      void send(accountId && (!(submitter instanceof HTMLButtonElement) || submitter.value !== 'submit') ? 'draft' : 'submit');
    }
  }} className="space-y-5">
    <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-950">{actor.kind === 'account'
      ? <>{t('account')} <bdi className="break-all">{actor.email}</bdi></> : t('guest')}</p>
    <p className="text-sm">{t('memory')}</p>
    {!editing && <ol className="flex flex-wrap gap-2 text-sm">{(['reporterStep', 'storyStep'] as const).map((key, i) => <li key={key} aria-current={step === i + 1 ? 'step' : undefined}
      className={`rounded-full px-3 py-1 ${step === i + 1 ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>{t(key)}</li>)}</ol>}
    <h2 tabIndex={-1} ref={firstHeading} className="text-2xl font-bold">{t(editing ? 'edit' : step === 1 ? 'reporterDetails' : 'storyDetails')}</h2>
    {draft && <><p>{t('draftInfo')}</p><p>{t('status')}: {reporterStatusText(locale, draft.reviewStatus)}</p></>}
    <fieldset disabled={freeze} className="min-w-0 space-y-5">
      {step === 1 ? <>
        {(actor.kind === 'guest' || form.fullName) && input('fullName', 'name', 'text', actor.kind === 'guest')}
        {input('email', 'email', 'email', true)}
        {actor.kind === 'account' && <p className="text-sm">{t('accountContact')}</p>}
        <div className="grid gap-4 sm:grid-cols-2">{input('phone', 'phone', 'tel')}{actor.kind === 'account' && input('whatsapp', 'whatsapp', 'tel')}
          {(['city', 'district', 'state', 'country'] as const).map(key => input(key, key))}</div>
        <fieldset className="space-y-2"><legend className="font-medium">{t('identity')}</legend>
          <div className="flex flex-wrap gap-4">{(['community', 'journalist'] as const).filter(v => v === 'community' || journalistOpen).map(type =>
            <label key={type}><input type="radio" name="identity" checked={form.reporterType === type} onChange={() => update('reporterType', type)} /> {t(type)}</label>)}</div>
          <p className="text-sm">{t('declaration')} {form.reporterType === 'journalist' && <Link className={linkClass} href="/journalist-desk">{t('desk')}</Link>}</p>
        </fieldset>
        {actor.kind === 'account' && <fieldset><legend>{t('beats')}</legend><div className="mt-2 flex flex-wrap gap-2">{interests.map(i => chip(i, optionText(locale, i, i)))}</div></fieldset>}
        {actor.kind === 'guest' && <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={form.contact} onChange={e => update('contact', e.target.checked)} />{t('contact')}</label>}
        {actor.kind === 'guest' && ethics}
        <button type="submit" className={button}>{t('next')}</button>
      </> : <>
        {accountId && <p className="text-sm">{t(draft?.reviewStatus === 'NEEDS_REVISION' ? 'revisionHint' : 'draftHint')}</p>}
        <div><label htmlFor="intake-category">{t('category')} *</label>
          <select id="intake-category" name="category" required={!accountId} className={field} value={form.category} {...aria('category')} onChange={e => update('category', e.target.value)}>
            <option value="" disabled={!!draft?.category}>{t('chooseCategory')}</option>{COMMUNITY_REPORTER_CATEGORY_OPTIONS.map(c =>
              <option key={c.value} value={c.value}>{optionText(locale, c.value, c.label)}</option>)}</select>{errorMessage('category')}</div>
        {!editing && actor.kind === 'account' && <fieldset><legend>{t('scope')} *</legend><div className="flex flex-wrap gap-4">{scopes.map(value =>
          <label key={value}><input name="scope" type="radio" checked={form.scope === value} {...aria('scope')} onChange={() => update('scope', value)} /> {optionText(locale, value, intakeCategory(value)!.label)}</label>
        )}</div>{errorMessage('scope')}</fieldset>}
        {input('headline', 'headline', 'text', !editing)}
        <div><label htmlFor="intake-story">{t('story')}{!editing && ' *'}</label><textarea id="intake-story" name="story" rows={8} className={`${field} resize-y`}
          required={!accountId} maxLength={accountId ? 50_000 : 10_000} value={form.story} {...aria('story')} onChange={e => update('story', e.target.value)} />{errorMessage('story')}</div>
        <div><label htmlFor="intake-language">{t('language')}</label><select id="intake-language" className={field} value={form.language}
          onChange={e => update('language', storyLanguage(e.target.value) ? e.target.value : '')}>
          <option value="" disabled={!!draft?.originalLanguage}>{t('unspecified')}</option>{storyLanguages.map(l => <option key={l} value={l}>{t(l)}</option>)}</select></div>
        {!editing && actor.kind === 'guest' && <div><label htmlFor="intake-age">{t('age')} *</label>
          <select id="intake-age" name="age" required className={field} value={form.age} {...aria('age')} onChange={e => update('age', e.target.value as FormState['age'])}>
            <option value="">{t('chooseAge')}</option>{(Object.keys(ageGroups) as AgeGroup[]).map(a => <option key={a} value={a}>{t(a)}</option>)}</select>{errorMessage('age')}</div>}
        {accountId && ethics}
        <div className="flex flex-wrap gap-3">{!editing && <button type="button" className={secondary} onClick={() => { if (!freeze) setStep(1); }}>{t('back')}</button>}
          {accountId && <button type="submit" value="draft" className={secondary} disabled={!editedAfterValidation || !dirty}>{t(editing ? 'save' : 'saveDraft')}</button>}
          <button type="submit" value="submit" className={button} disabled={!editedAfterValidation}>{t(busy ? 'submitting' : 'submit')}</button></div>
      </>}
    </fieldset>
    {receiptBox}
    {issue && <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-4 text-amber-950">
      <p>{t(issue === 'uncertain' && editing ? 'editUncertain' : issue)}</p>
      {editing && uncertain && <><Link href={`/reporter/submissions/${draft!.id}`} className={linkClass} target="_blank" rel="noopener noreferrer">{t('viewSaved')}</Link>{' '}
        <button type="button" className={secondary} disabled={reconciling || disabled} onClick={() => void reconcile()}>{t('reconcile')}</button></>}
      {issue === 'draftUncertain' && <button type="button" className={secondary} disabled={disabled || busy} onClick={() => void send('draft', true)}>{t('retryDraft')}</button>}
      {!editing && (uncertain || issue === 'draftUncertain' || issue === 'draftConflict') && actor.kind === 'account' && portalOpen && <Link className={linkClass} href={tracks} target="_blank" rel="noopener noreferrer">{t('track')}</Link>}
    </div>}
    {checked && <p role="status">{t('checked')}</p>}
  </form>;
}
