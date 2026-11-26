import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useCommunityStories, type StoryView } from '../../hooks/useCommunityStories';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { fetchPublicSettings, withdrawStoryById } from '../../lib/communityReporterApi';
import { reporterStatusText, reporterText } from '../../lib/reporterCopy';
import { intakeCategory } from '../../lib/communityReporterIntake';
import { intakeText, optionText } from '../community-reporter/intakeCopy';
import { editionHref, reporterObjectId, type ReporterStory, type StorySummary } from '../../lib/reporterStories';
import type { FeatureToggleProps } from '../../types/community-reporter';
import ReporterPortalLayout from './ReporterPortalLayout';

const panel = 'min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';
const link = 'rounded-lg px-2 py-1 font-semibold text-blue-700 underline';

function useText() {
  const { locale } = useRouter();
  return (en: string, hi: string, gu: string) => reporterText(locale, en, hi, gu);
}

function Status({ story }: { story: ReporterStory }) {
  const { locale } = useRouter();
  const t = useText();
  return <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
    <span>{t('Review', 'समीक्षा', 'સમીક્ષા')}: <strong>{reporterStatusText(locale, story.reviewStatus)}</strong></span>
    <span>{t('Publication', 'प्रकाशन', 'પ્રકાશન')}: <strong>{reporterStatusText(locale, story.publicationStatus)}</strong></span>
  </span>;
}

function categoryLabel(locale: string | undefined, category: string | null) {
  const option = intakeCategory(category);
  return option ? optionText(locale, option.value, option.label) : category;
}

function Counts({ summary }: { summary: StorySummary }) {
  const t = useText();
  return <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
    {([
      [t('All stories, including private drafts', 'निजी मसौदों सहित सभी रिपोर्टें', 'ખાનગી ડ્રાફ્ટ સહિત બધા અહેવાલો'), summary.totalSubmissions],
      [t('Received', 'प्राप्त', 'પ્રાપ્ત'), summary.received],
      [t('Pending review', 'समीक्षा लंबित', 'સમીક્ષા બાકી'), summary.pending],
      [t('Approved', 'स्वीकृत', 'મંજૂર'), summary.approved],
      [t('Rejected', 'अस्वीकृत', 'નામંજૂર'), summary.rejected],
      [t('Published stories', 'प्रकाशित रिपोर्टें', 'પ્રકાશિત અહેવાલો'), summary.published],
    ] as const).map(([label, count]) => <div className={panel} key={label}><dt>{label}</dt><dd className="mt-2 text-3xl font-black">{count}</dd></div>)}
  </dl>;
}

function StoryDetail({ story, accountId, reload }: { story: ReporterStory; accountId: string; reload: () => void }) {
  const t = useText();
  const { locale } = useRouter();
  const [withdrawState, setWithdraw] = useState<'idle'|'working'|'error'>('idle');
  const busy = useRef(false);
  return <article className={`${panel} space-y-4 break-words`}>
    <h2 className="text-2xl font-bold">{story.headline}</h2>
    <Status story={story} />
    {story.category && <p>{categoryLabel(locale, story.category)}</p>}
    {story.location && <p>{[story.location.city, story.location.state, story.location.country].filter(Boolean).join(', ')}</p>}
    <p className="whitespace-pre-wrap">{story.story}</p>
    <div><strong>{t('Submission reference', 'रिपोर्ट संदर्भ', 'અહેવાલ સંદર્ભ')}: </strong><span className="break-all">{story.id}</span></div>
    <section aria-label={t('Editorial feedback', 'संपादकीय प्रतिक्रिया', 'સંપાદકીય પ્રતિસાદ')}>
      <h3 className="font-bold">{t('Editorial feedback', 'संपादकीय प्रतिक्रिया', 'સંપાદકીય પ્રતિસાદ')}</h3>
      <p className="whitespace-pre-wrap">{story.reporterFeedback || t('No feedback has been released to you.', 'आपके लिए कोई प्रतिक्रिया जारी नहीं की गई है।', 'તમારા માટે કોઈ પ્રતિસાદ જાહેર કરાયો નથી.')}</p>
    </section>
    {story.isPublished && <div className="flex flex-wrap gap-2">{story.editions.map(edition => {
      const href = editionHref(edition);
      return href && <a key={edition.language} className={link} href={href} hrefLang={edition.language}>
        {t('Read published article', 'प्रकाशित लेख पढ़ें', 'પ્રકાશિત લેખ વાંચો')} ({edition.language.toUpperCase()})
      </a>;
    })}</div>}
    {story.canEdit && <Link className={link} href={`/reporter/submit?draft=${story.id}`}>{story.reviewStatus === 'DRAFT'
      ? intakeText(locale, 'editDraft') : t('Edit submission', 'रिपोर्ट संपादित करें', 'અહેવાલમાં ફેરફાર કરો')}</Link>}
    {story.canWithdraw && <button className={link} disabled={withdrawState === 'working'} onClick={async () => {
      if (busy.current || !window.confirm(t('Withdraw this submission from review?', 'क्या इस रिपोर्ट को समीक्षा से वापस लें?', 'શું આ અહેવાલ સમીક્ષામાંથી પાછો ખેંચવો છે?'))) return;
      busy.current = true;
      setWithdraw('working');
      try { await withdrawStoryById(story.id, accountId); reload(); }
      catch { setWithdraw('error'); } finally { busy.current = false; }
    }}>{t('Withdraw submission', 'रिपोर्ट वापस लें', 'અહેવાલ પાછો ખેંચો')}</button>}
    {withdrawState === 'error' && <p role="alert">{t('Withdrawal was not confirmed. Refresh the record before trying again.', 'वापसी की पुष्टि नहीं हुई। फिर कोशिश करने से पहले रिपोर्ट रीफ़्रेश करें।', 'પાછો ખેંચાયાની પુષ્ટિ નથી. ફરી પ્રયાસ કરતાં પહેલાં અહેવાલ રિફ્રેશ કરો.')}</p>}
    <Link className={link} href="/reporter/submissions">{t('All submissions', 'सभी रिपोर्टें', 'બધા અહેવાલો')}</Link>
  </article>;
}

export default function ReporterRecords({ view, communityReporterClosed, reporterPortalClosed }: FeatureToggleProps & { view: StoryView }) {
  const t = useText();
  const router = useRouter();
  const auth = useReporterPortalSession({ reportUnauthorizedReason: true });
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, youthPulseSubmissionsClosed: false, updatedAt: null });
  const accountId = auth.status === 'authenticated' && reporterObjectId(auth.session?.accountId) ? auth.session.accountId : null;
  const closed = toggles.communityReporterClosed || toggles.reporterPortalClosed;
  const [gate, setGate] = useState<{ accountId: string; open: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setGate(null);
    if (!accountId || closed) return;
    let current = true;
    void fetchPublicSettings().then(s => {
      if (current) setGate({ accountId, open: Boolean(s?.allowMyStoriesPortal && s?.communityReporterEnabled) });
    });
    return () => { current = false; };
  }, [accountId, closed, attempt]);

  const id = typeof router.query?.id === 'string' ? router.query.id : '';
  const [pagination, setPage] = useState({ accountId, page: 1 });
  const page = pagination.accountId === accountId ? pagination.page : 1;
  const available = Boolean(!closed && accountId && gate?.accountId === accountId && gate.open);
  const { result, reload } = useCommunityStories(available && (view !== 'detail' || id) ? accountId : null, view, page, id);
  const path = router.asPath?.startsWith('/reporter/') ? router.asPath.split(/[?#]/)[0] : '/reporter/submissions';
  const login = `/reporter/login?next=${encodeURIComponent(path)}`;
  const denied = result.state === 'error' && (result.status === 401 || result.status === 403 || result.status === 409);
  useEffect(() => {
    if (!closed && (auth.status === 'anonymous' || denied)) void router.replace(login);
  }, [auth.status, closed, denied, login, router]);

  const title = view === 'dashboard' ? t('Reporter Dashboard', 'रिपोर्टर डैशबोर्ड', 'રિપોર્ટર ડૅશબોર્ડ')
    : view === 'detail' ? t('Submission details', 'रिपोर्ट का विवरण', 'અહેવાલની વિગતો') : t('My Submissions', 'मेरी रिपोर्टें', 'મારા અહેવાલો');
  const errorText = t('Records are temporarily unavailable.', 'रिपोर्टें अभी उपलब्ध नहीं हैं।', 'અહેવાલો હાલ ઉપલબ્ધ નથી.');
  const busy = t('Checking reporter session…', 'रिपोर्टर सत्र की जाँच हो रही है…', 'રિપોર્ટર સત્રની તપાસ થઈ રહી છે…');
  const retry = t('Try again', 'फिर प्रयास करें', 'ફરી પ્રયાસ કરો');
  return <ReporterPortalLayout title={title} description={t('Review and publication are tracked separately.', 'समीक्षा और प्रकाशन की स्थितियाँ अलग हैं।', 'સમીક્ષા અને પ્રકાશનની સ્થિતિ અલગ છે.')}
    active={view === 'dashboard' ? 'dashboard' : 'submissions'} session={accountId && !denied && !closed ? auth.session : null}
    onLogout={accountId && !denied && !closed ? () => { void auth.logout(); } : undefined}>
    {closed ? <p role="status">{t('The Reporter Portal is closed.', 'रिपोर्टर पोर्टल बंद है।', 'રિપોર્ટર પોર્ટલ બંધ છે.')}</p>
      : !accountId || denied || gate?.accountId !== accountId ? <p role="status">{busy}</p>
      : !available ? <p role="alert">{errorText} <button className={link} onClick={() => setAttempt(v => v + 1)}>{retry}</button></p>
      : result.state === 'loading' ? <p role="status">{t('Loading submissions…', 'रिपोर्टें लोड हो रही हैं…', 'અહેવાલો લોડ થઈ રહ્યા છે…')}</p>
      : result.state === 'error' ? <div role="alert"><p>{result.status === 404 ? t('Submission not found.', 'रिपोर्ट नहीं मिली।', 'અહેવાલ મળ્યો નથી.') : errorText}</p><button className={link} onClick={reload}>{retry}</button></div>
      : <div className="space-y-5">
        {result.data.story && <StoryDetail key={`${accountId}:${id}`} story={result.data.story} accountId={accountId} reload={reload} />}
        {result.data.summary && <Counts summary={result.data.summary} />}
        {result.data.list && <section className={panel}>
          <h2 className="text-xl font-bold">{view === 'dashboard' ? t('Recent submissions', 'हाल की रिपोर्टें', 'તાજેતરના અહેવાલો') : title}</h2>
          {!result.data.list.items.length && <p className="py-4">{t('No submissions linked to this account.', 'इस खाते से कोई रिपोर्ट नहीं जुड़ी है।', 'આ ખાતા સાથે કોઈ અહેવાલ જોડાયેલો નથી.')}</p>}
          <ul className="divide-y">{result.data.list.items.map(s => <li key={s.id} className="min-w-0 space-y-2 py-4">
            <Link className={`${link} break-words`} href={`/reporter/submissions/${s.id}`}>{s.headline || t('Untitled draft', 'शीर्षकहीन मसौदा', 'શીર્ષક વિનાનો ડ્રાફ્ટ')}</Link>
            <p>{[categoryLabel(router.locale, s.category), s.createdAt && !Number.isNaN(Date.parse(s.createdAt)) ? new Date(s.createdAt).toLocaleDateString(router.locale) : null].filter(Boolean).join(' · ')}</p>
            <Status story={s} />
          </li>)}</ul>
          {view === 'dashboard' ? <Link className={link} href="/reporter/submissions">{t('View all submissions', 'सभी रिपोर्टें देखें', 'બધા અહેવાલો જુઓ')}</Link>
            : <div className="flex gap-4">{page > 1 && <button className={link} onClick={() => setPage({ accountId, page: page - 1 })}>{t('Previous', 'पिछला', 'પાછલું')}</button>}
              {page * result.data.list.limit < result.data.list.total && <button className={link} onClick={() => setPage({ accountId, page: page + 1 })}>{t('Next', 'अगला', 'આગળ')}</button>}</div>}
        </section>}
      </div>}
  </ReporterPortalLayout>;
}
