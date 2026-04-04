import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import type { SubmitCommunityStoryResult } from '../src/lib/communityReporterApi';
import { useCommunityReporterConfig } from '../src/hooks/useCommunityReporterConfig';
import { usePublicMode } from '../utils/PublicModeProvider';
import { fetchServerPublicFounderToggles } from '../lib/publicFounderToggles';

// Phase 1 Community Reporter Submission Page
// Route: /community-reporter

type ReporterType = 'community' | 'journalist';

interface ReporterSignUpState {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  district: string;
  state: string;
  country: string;
  preferredLanguages: string[];
  consentToContact: boolean;
  heardAbout?: string;
  isProfessionalJournalist: boolean;
  communityInterests: string[];
  organisationName?: string;
  organisationType?: 'print' | 'tv' | 'radio' | 'digital' | 'freelance' | 'other';
  positionTitle?: string;
  beatsProfessional?: string[];
  yearsExperience?: string;
  professionalJournalistId?: string;
  journalistCharterAccepted: boolean;
  generalEthicsAccepted: boolean;
}

interface StoryFormState {
  ageGroup: string;
  category: string; // Stores slug value e.g. 'regional'
  coverageScope: '' | 'regional' | 'national' | 'international';
  headline: string;
  story: string;
  mediaLink?: string;
  storyCity?: string;
  storyDistrict?: string;
  storyState?: string;
  storyCountry?: string;
  priority?: 'normal' | 'high';
}

const initialSignUp: ReporterSignUpState = {
  fullName: '',
  email: '',
  phone: '',
  whatsapp: '',
  city: '',
  district: '',
  state: '',
  country: 'India',
  preferredLanguages: [],
  consentToContact: false,
  heardAbout: '',
  isProfessionalJournalist: false,
  communityInterests: [],
  organisationName: '',
  organisationType: undefined,
  positionTitle: '',
  beatsProfessional: [],
  yearsExperience: '',
  professionalJournalistId: '',
  journalistCharterAccepted: false,
  generalEthicsAccepted: false,
};

const initialStory: StoryFormState = {
  ageGroup: '',
  category: '',
  coverageScope: '',
  headline: '',
  story: '',
  mediaLink: '',
  storyCity: '',
  storyDistrict: '',
  storyState: '',
  storyCountry: '',
  priority: 'normal',
};

const categories: { value: string; label: string }[] = [
  { value: 'regional', label: 'Regional' },
  { value: 'youth_campus', label: 'Youth / Campus' },
  { value: 'civic_issue', label: 'Civic Issue' },
  { value: 'lifestyle_culture', label: 'Lifestyle / Culture' },
  { value: 'general_tip', label: 'General Tip' },
];

const LANG_OPTIONS = ['en', 'hi', 'gu'];
const COMMUNITY_INTERESTS = ['Local issues','Youth','Politics','Civic','Education','Health','Environment','Sports','Culture'];
const PROFESSIONAL_BEATS = ['Politics','Crime','Business','Education','Civic','Sports','Entertainment','Tech','Other'];

type FeatureToggleProps = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
};

const CommunityReporterPage: React.FC<FeatureToggleProps> = ({ communityReporterClosed, reporterPortalClosed }) => {
  const router = useRouter();
  const { readOnly } = usePublicMode();
  const submitInFlightRef = useRef(false);
  const skipNextProfilePersistRef = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [reporterType, setReporterType] = useState<ReporterType>('community');
  const [signUpData, setSignUpData] = useState<ReporterSignUpState>(initialSignUp);
  const [savedDetailsRestoredFromStorage, setSavedDetailsRestoredFromStorage] = useState(false);
  const [hasSavedDetailsInStorage, setHasSavedDetailsInStorage] = useState(false);
  const [journalistIdFile, setJournalistIdFile] = useState<File | null>(null);
  const [journalistIdUpload, setJournalistIdUpload] = useState<{ status: 'idle' | 'uploading' | 'success' | 'error'; fileId?: string; message?: string }>({ status: 'idle' });
  const [story, setStory] = useState<StoryFormState>(initialStory);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitCommunityStoryResult | null>(null);
  const { config } = useCommunityReporterConfig();
  const myStoriesEnabledLegacy = config?.communityMyStoriesEnabled ?? true;
  type CommunitySettingsPublic = {
    communityReporterEnabled: boolean;
    allowNewSubmissions: boolean;
    allowMyStoriesPortal: boolean;
    allowJournalistApplications: boolean;
  };
  const [settings, setSettings] = useState<CommunitySettingsPublic | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  // Category values already use stable slugs; no mapping required.

  // Public backend base URL (no prod fallback)
  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE || '').toString().trim().replace(/\/+$/, '');

  const [reporterAccountId, setReporterAccountId] = useState<string>('');

  const safeRandomId = () => {
    try {
      const g = (globalThis as any).crypto;
      if (g && typeof g.getRandomValues === 'function') {
        const buf = new Uint8Array(16);
        g.getRandomValues(buf);
        return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    return `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  };

  const getOrCreateReporterAccountId = () => {
    try {
      if (typeof window === 'undefined') return '';
      const key = 'np_cr_account_id_v1';
      const existing = String(window.localStorage.getItem(key) || '').trim();
      if (existing) return existing;
      const created = safeRandomId();
      window.localStorage.setItem(key, created);
      return created;
    } catch {
      return '';
    }
  };

  const clearSavedReporterDetails = (opts?: { startFresh?: boolean }) => {
    try {
      if (typeof window === 'undefined') return;
      // Profile persistence keys
      window.localStorage.removeItem('np_cr_profile_v1');
      window.localStorage.removeItem('np_cr_email');

      // Identity anchors used by My Stories
      window.localStorage.removeItem('np_communityReporterEmail');
      window.localStorage.removeItem('np_communityReporterId');

      if (opts?.startFresh) {
        // Reset the per-browser account id so the next submit is a clean identity.
        window.localStorage.removeItem('np_cr_account_id_v1');
      }
    } catch {}

    setSavedDetailsRestoredFromStorage(false);
    setHasSavedDetailsInStorage(false);

    // Ensure any pending debounce write doesn't immediately re-create the cleared keys.
    skipNextProfilePersistRef.current = true;

    if (opts?.startFresh) {
      setReporterType('community');
      setSignUpData(initialSignUp);
      setStory(initialStory);
      setErrors({});
      setSubmitStatus('idle');
      setSubmitError(null);
      setSubmitResult(null);
      setJournalistIdFile(null);
      setJournalistIdUpload({ status: 'idle' });
      setStep(1);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    } else {
      // Trigger a render so the next debounce cycle consumes the skip.
      setSignUpData((s) => ({ ...s }));
    }
  };

  // Prefill profile from localStorage (keeps onboarding reliable across visits)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const id = getOrCreateReporterAccountId();
      if (id) setReporterAccountId(id);

      const raw = window.localStorage.getItem('np_cr_profile_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const hasMeaningfulSavedDetails = Boolean(
        (typeof parsed.fullName === 'string' && parsed.fullName.trim()) ||
        (typeof parsed.email === 'string' && parsed.email.trim()) ||
        (typeof parsed.phone === 'string' && parsed.phone.trim()) ||
        (typeof parsed.whatsapp === 'string' && parsed.whatsapp.trim()) ||
        (typeof parsed.city === 'string' && parsed.city.trim()) ||
        (typeof parsed.district === 'string' && parsed.district.trim()) ||
        (typeof parsed.state === 'string' && parsed.state.trim()) ||
        (typeof parsed.country === 'string' && parsed.country.trim()) ||
        (Array.isArray(parsed.preferredLanguages) && parsed.preferredLanguages.length) ||
        (Array.isArray(parsed.communityInterests) && parsed.communityInterests.length) ||
        parsed.consentToContact === true
      );
      if (hasMeaningfulSavedDetails) {
        setSavedDetailsRestoredFromStorage(true);
        setHasSavedDetailsInStorage(true);
      }
      setSignUpData((s) => ({
        ...s,
        fullName: typeof parsed.fullName === 'string' ? parsed.fullName : s.fullName,
        email: typeof parsed.email === 'string' ? parsed.email : s.email,
        phone: typeof parsed.phone === 'string' ? parsed.phone : s.phone,
        whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : s.whatsapp,
        city: typeof parsed.city === 'string' ? parsed.city : s.city,
        district: typeof parsed.district === 'string' ? parsed.district : s.district,
        state: typeof parsed.state === 'string' ? parsed.state : s.state,
        country: typeof parsed.country === 'string' ? parsed.country : s.country,
        preferredLanguages: Array.isArray(parsed.preferredLanguages) ? parsed.preferredLanguages : s.preferredLanguages,
        communityInterests: Array.isArray(parsed.communityInterests) ? parsed.communityInterests : s.communityInterests,
        consentToContact: typeof parsed.consentToContact === 'boolean' ? parsed.consentToContact : s.consentToContact,
      }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist profile edits for later submissions.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (typeof window === 'undefined') return;
        if (skipNextProfilePersistRef.current) {
          skipNextProfilePersistRef.current = false;
          return;
        }
        const payload = {
          fullName: signUpData.fullName,
          email: signUpData.email,
          phone: signUpData.phone,
          whatsapp: signUpData.whatsapp,
          city: signUpData.city,
          district: signUpData.district,
          state: signUpData.state,
          country: signUpData.country,
          preferredLanguages: signUpData.preferredLanguages,
          communityInterests: signUpData.communityInterests,
          consentToContact: signUpData.consentToContact,
        };
        window.localStorage.setItem('np_cr_profile_v1', JSON.stringify(payload));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [signUpData]);

  // Fetch public community settings on mount
  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsError(null);
    fetch(`${API_BASE_URL}/api/public/community/settings`, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data && data.ok === true && data.settings) {
          setSettings({
            communityReporterEnabled: Boolean(data.settings.communityReporterEnabled),
            allowNewSubmissions: Boolean(data.settings.allowNewSubmissions),
            allowMyStoriesPortal: Boolean(data.settings.allowMyStoriesPortal),
            allowJournalistApplications: Boolean(data.settings.allowJournalistApplications),
          });
        } else {
          setSettingsError('SETTINGS_FETCH_FAILED');
        }
      })
      .catch(() => {
        if (!cancelled) setSettingsError('SETTINGS_FETCH_EXCEPTION');
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const myStoriesEnabled = settings ? Boolean(settings.allowMyStoriesPortal) : myStoriesEnabledLegacy;
  const readonlyMode = settings ? (settings.communityReporterEnabled === true && settings.allowNewSubmissions === false) : false;
  const journalistApplicationsOpen = settings ? Boolean(settings.allowJournalistApplications) : true;

  // Global readOnly from PublicModeProvider overrides local readonlyMode
  const effectiveReadOnly = readOnly || readonlyMode;

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!signUpData.fullName.trim()) e.fullName = 'Full name is required.';
    const hasEmail = Boolean(signUpData.email.trim());
    const hasPhone = Boolean(signUpData.phone.trim());
    const hasWhatsApp = Boolean(signUpData.whatsapp.trim());
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpData.email)) e.email = 'Enter a valid email.';
    if (!hasEmail && !hasPhone && !hasWhatsApp) {
      e.email = 'Add at least one contact method (email, phone, or WhatsApp).';
    }
    if (!signUpData.generalEthicsAccepted) e.generalEthicsAccepted = 'You must accept ethics policy.';
    if (reporterType === 'journalist') {
      if (!signUpData.journalistCharterAccepted) e.journalistCharterAccepted = 'Charter acceptance required.';
      if (!signUpData.organisationName?.trim()) e.organisationName = 'Organisation name is required.';
      if (!signUpData.positionTitle?.trim()) e.positionTitle = 'Position title is required.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!story.ageGroup) e.ageGroup = 'Select an age group.';
    if (!story.category) e.category = 'Select a category.';
    if (!story.coverageScope) e.coverageScope = 'Select a coverage scope.';
    if (!story.headline.trim()) e.headline = 'Headline is required.';
    if (story.headline.length > 150) e.headline = 'Headline exceeds 150 characters.';
    if (!story.story.trim()) e.story = 'Story is required.';
    else if (story.story.trim().length < 50) e.story = 'Story must be at least 50 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const missingRecommendedProfileFields = useMemo(() => {
    const missing: string[] = [];
    const email = signUpData.email.trim();
    const phone = signUpData.phone.trim();
    const wa = signUpData.whatsapp.trim();
    if (!email) missing.push('email');
    if (!phone && !wa) missing.push('phone/WhatsApp');
    if (!signUpData.city.trim()) missing.push('city');
    if (!signUpData.district.trim()) missing.push('district');
    if (!signUpData.state.trim()) missing.push('state');
    if (!signUpData.country.trim()) missing.push('country');
    if (!signUpData.preferredLanguages.length) missing.push('preferred language');
    if (!signUpData.communityInterests.length && reporterType === 'community') missing.push('beats');
    if (!signUpData.consentToContact) missing.push('consent to contact');
    return missing;
  }, [reporterType, signUpData]);

  const handleSubmitStep2: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setSubmitError(null);
    setSubmitResult(null);
    setSubmitStatus('idle');
    if (!validateStep2()) return;
    submitInFlightRef.current = true;
    setSubmitStatus('submitting');
    try {
      let uploadedIdFileId: string | undefined = undefined;

      // Optional: upload journalist ID proof before submitting story
      if (reporterType === 'journalist' && journalistIdFile) {
        setJournalistIdUpload({ status: 'uploading' });
        const fd = new FormData();
        fd.append('file', journalistIdFile);
        if (signUpData.email?.trim()) fd.append('email', signUpData.email.trim());
        if (signUpData.professionalJournalistId?.trim()) fd.append('note', signUpData.professionalJournalistId.trim());
        const up = await fetch('/api/community-reporter/upload-id', { method: 'POST', body: fd });
        const upData: any = await up.json().catch(() => ({}));
        if (!up.ok || upData?.ok !== true) {
          const msg = upData?.message || upData?.error || 'Could not upload ID proof.';
          setJournalistIdUpload({ status: 'error', message: msg });
          // Do not block story submission if upload fails (keeps UX forgiving)
        } else {
          uploadedIdFileId = upData?.fileId || upData?.id || undefined;
          setJournalistIdUpload({ status: 'success', fileId: uploadedIdFileId });
        }
      }

      const locationCity = ((story.storyCity || '').trim() || signUpData.city.trim());
      const locationState = ((story.storyState || '').trim() || signUpData.state.trim());
      const location = [locationCity, locationState].filter(Boolean).join(', ');

      const storedReporterProfileId = (() => {
        try {
          if (typeof window === 'undefined') return '';
          return String(window.localStorage.getItem('np_communityReporterId') || '').trim();
        } catch {
          return '';
        }
      })();

      const payload = {
        // Identity anchors
        reporterAccountId: reporterAccountId || undefined,
        reporterProfileId: storedReporterProfileId || undefined,
        reporterType,
        consentToContact: Boolean(signUpData.consentToContact),

        // Reporter profile fields (flat, backend-friendly)
        reporterName: signUpData.fullName.trim(),
        reporterEmail: signUpData.email.trim(),
        reporterPhone: signUpData.phone.trim(),
        reporterWhatsApp: signUpData.whatsapp.trim(),
        reporterCity: signUpData.city.trim(),
        reporterDistrict: signUpData.district.trim(),
        reporterState: signUpData.state.trim(),
        reporterCountry: signUpData.country.trim(),
        preferredLanguages: signUpData.preferredLanguages,
        beats: reporterType === 'community' ? signUpData.communityInterests : (signUpData.beatsProfessional || []),
        heardAbout: (signUpData.heardAbout || '').trim() || undefined,

        // Journalist extras (when applicable)
        organisationName: (signUpData.organisationName || '').trim() || undefined,
        organisationType: signUpData.organisationType || undefined,
        positionTitle: (signUpData.positionTitle || '').trim() || undefined,
        beatsProfessional: signUpData.beatsProfessional || undefined,
        yearsExperience: (signUpData.yearsExperience || '').trim() || undefined,
        professionalJournalistId: (signUpData.professionalJournalistId || '').trim() || undefined,
        journalistCharterAccepted: Boolean(signUpData.journalistCharterAccepted),
        generalEthicsAccepted: Boolean(signUpData.generalEthicsAccepted),
        journalistIdFileId: uploadedIdFileId || undefined,

        // Story fields
        category: story.category,
        coverageScope: story.coverageScope,
        headline: story.headline.trim(),
        storyText: story.story.trim(),
        ageGroup: story.ageGroup,
        priority: story.priority || 'normal',
        mediaLink: (story.mediaLink || '').trim() || undefined,
        storyCity: (story.storyCity || '').trim() || undefined,
        storyDistrict: (story.storyDistrict || '').trim() || undefined,
        storyState: (story.storyState || '').trim() || undefined,
        storyCountry: (story.storyCountry || '').trim() || undefined,

        // Back-compat keys (keep existing backend behavior)
        name: signUpData.fullName.trim(),
        email: signUpData.email.trim(),
        location,
        story: story.story.trim(),
      };
      const res = await fetch('/api/community-reporter/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let data: any = null;
        try {
          data = await res.json();
        } catch (e) {}
        console.error('Community Reporter submit failed:', res.status, data);
        const msg = data?.message || 'We couldn’t submit your story right now. Please try again in a few minutes.';
        setSubmitError(msg);
        setSubmitStatus('error');
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (res.ok) {
        // Extract and persist reporter identity for My Stories
        const storyId = data?.storyId || data?.id || data?.reference || data?.referenceId || '';
        const reporterId = data?.reporterId || data?.reporter?.id || '';
        const reporterEmail = data?.reporterEmail || data?.reporter?.email || signUpData.email?.trim();
        try {
          if (typeof window !== 'undefined') {
            if (reporterId) window.localStorage.setItem('np_communityReporterId', String(reporterId));
            if (reporterEmail) window.localStorage.setItem('np_communityReporterEmail', String(reporterEmail));
          }
        } catch {}
        const ref = String(storyId || '');
        const mapped: SubmitCommunityStoryResult = {
          ok: true,
          referenceId: ref,
          status: data?.status || 'Under review',
          reporterType: reporterType,
        };
        setSubmitResult(mapped);
        setSubmitStatus('success');
        // Optional link at bottom already present; main nav handled by user action
      }
    } catch (err) {
      console.error('[community-reporter submit] exception', err);
      setSubmitError('We couldn’t submit your story right now. Please try again in a few minutes.');
      setSubmitStatus('error');
    } finally {
      submitInFlightRef.current = false;
      // Status already set; no extra action here
    }
  };

  // If globally closed via feature toggle, show closed message immediately
  if (communityReporterClosed) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>Community Reporter – Temporarily Closed | News Pulse</title>
        </Head>
        <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              News Pulse Community Reporter
            </h1>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-lg md:text-xl leading-relaxed text-gray-700 dark:text-gray-300">
                Temporarily closed. Please check back soon.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Loading state while settings load
  if (settingsLoading && !settings) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text grid place-items-center">
        <p className="text-sm text-gray-700 dark:text-gray-300">Loading settings…</p>
      </div>
    );
  }

  // Closed state when program disabled
  if (settings && !settings.communityReporterEnabled) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>Community Reporter – Currently Unavailable | News Pulse</title>
        </Head>
        <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              News Pulse Community Reporter
            </h1>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-lg md:text-xl leading-relaxed text-gray-700 dark:text-gray-300">
                The Community Reporter program is currently not available. Please check again later.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Global readOnly or feature-level readonlyMode: show read-only notice
  if (effectiveReadOnly && submitStatus !== 'success') {
    return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Community Reporter – Submit Your Story | News Pulse</title>
        <meta name="description" content="Submit your story to News Pulse. For community reporters and professional journalists: Step 1 for reporter details with ethics/charter, Step 2 for your story." />
      </Head>

      {/* Hero / Intro */}
      <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            News Pulse Community Reporter
          </h1>
          <p className="text-lg md:text-xl leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
            Share impactful local stories, emerging issues, campus updates, and verified tips. Every submission is manually reviewed by our editorial team before publishing.
          </p>
          <div className="mb-4">
            {(!reporterPortalClosed && myStoriesEnabled) ? (
              <Link
                href={`/community-reporter/my-stories${signUpData.email ? `?email=${encodeURIComponent(signUpData.email.trim().toLowerCase())}` : ''}`}
                className="text-sm text-blue-700 hover:underline"
              >
                Already submitted? View my submission records
              </Link>
            ) : null}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-3">📖 Read-Only Mode</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Submissions are temporarily paused due to maintenance or policy updates. You can browse existing stories in the meantime.
            </p>
            {myStoriesEnabled && (
              <div className="mt-4">
                <Link
                  href="/community-reporter-my-stories"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  View My Stories
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Community Reporter – Submit Your Story | News Pulse</title>
        <meta name="description" content="Submit your story to News Pulse. For community reporters and professional journalists: Step 1 for reporter details with ethics/charter, Step 2 for your story." />
      </Head>

      {/* Hero / Intro */}
      <section className="relative py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            News Pulse Community Reporter
          </h1>
          <p className="text-lg md:text-xl leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
            Share impactful local stories, emerging issues, campus updates, and verified tips. Every submission is manually reviewed by our editorial team before publishing.
          </p>
          <div className="mb-4">
            {(!reporterPortalClosed && myStoriesEnabled) ? (
              <Link
                href={`/community-reporter/my-stories${signUpData.email ? `?email=${encodeURIComponent(signUpData.email.trim().toLowerCase())}` : ''}`}
                className="text-sm text-blue-700 hover:underline"
              >
                Already submitted? View my submission records
              </Link>
            ) : null}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-4">
            <h2 className="text-xl font-semibold mb-3">Submission Guidelines</h2>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>No hate speech or discriminatory content.</li>
              <li>No intentionally false or misleading information.</li>
              <li>No personal attacks, harassment, or doxxing.</li>
              <li>Respect privacy & safety; blur sensitive personal data.</li>
              <li>Campus / youth stories must be authentic and respectful.</li>
            </ul>
          </div>
          <div className="px-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Step 1: Reporter Details</span>
                <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Step 2: Submit Your Story</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={step === 1 ? undefined : handleSubmitStep2} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-2">{step === 1 ? 'Reporter Details' : 'Submit Your Story'}</h2>
            {effectiveReadOnly && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Submissions are temporarily paused (read-only mode). You can browse the program details below.
              </div>
            )}
                    {step === 1 && (
                      <div className="space-y-6 border-b border-gray-200 dark:border-gray-700 pb-6">
                        {(savedDetailsRestoredFromStorage || hasSavedDetailsInStorage) && (
                          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <p className="font-semibold">Using saved reporter details</p>
                                <p className="text-xs mt-0.5">These details were restored from this browser.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-blue-800 text-xs font-semibold"
                                  onClick={() => clearSavedReporterDetails({ startFresh: false })}
                                >
                                  Clear saved details
                                </button>
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                                  onClick={() => clearSavedReporterDetails({ startFresh: true })}
                                >
                                  Start fresh
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Identity */}
                        <div>
                          <label htmlFor="fullName" className="block font-medium mb-1">Full name *</label>
                          <input id="fullName" type="text" value={signUpData.fullName} onChange={e => setSignUpData(s => ({ ...s, fullName: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>}
                        </div>
                        <div>
                          <label htmlFor="email" className="block font-medium mb-1">Email *</label>
                          <input id="email" type="email" value={signUpData.email} onChange={e => setSignUpData(s => ({ ...s, email: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
                        </div>
                        <div>
                          <label htmlFor="phone" className="block font-medium mb-1">Phone</label>
                          <input id="phone" type="tel" value={signUpData.phone} onChange={e => setSignUpData(s => ({ ...s, phone: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
                          <p className="text-xs text-gray-500 mt-1">For verification only, never shown publicly.</p>
                        </div>
                        <div>
                          <label htmlFor="whatsapp" className="block font-medium mb-1">WhatsApp (optional)</label>
                          <input id="whatsapp" type="tel" value={signUpData.whatsapp} onChange={e => setSignUpData(s => ({ ...s, whatsapp: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          <p className="text-xs text-gray-500 mt-1">If different from phone.</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="city" className="block font-medium mb-1">City</label>
                            <input id="city" type="text" value={signUpData.city} onChange={e => setSignUpData(s => ({ ...s, city: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            {errors.city && <p className="text-red-600 text-xs mt-1">{errors.city}</p>}
                          </div>
                          <div>
                            <label htmlFor="district" className="block font-medium mb-1">District</label>
                            <input id="district" type="text" value={signUpData.district} onChange={e => setSignUpData(s => ({ ...s, district: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          </div>
                          <div>
                            <label htmlFor="state" className="block font-medium mb-1">State</label>
                            <input id="state" type="text" value={signUpData.state} onChange={e => setSignUpData(s => ({ ...s, state: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
                          </div>
                          <div>
                            <label htmlFor="country" className="block font-medium mb-1">Country</label>
                            <input id="country" type="text" value={signUpData.country} onChange={e => setSignUpData(s => ({ ...s, country: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            {errors.country && <p className="text-red-600 text-xs mt-1">{errors.country}</p>}
                          </div>
                        </div>

                        {/* Preferred languages */}
                        <div>
                          <label className="block font-medium mb-2">Preferred languages</label>
                          <div className="flex flex-wrap gap-2">
                            {LANG_OPTIONS.map(code => (
                              <button type="button" key={code} onClick={() => setSignUpData(s => ({ ...s, preferredLanguages: s.preferredLanguages.includes(code) ? s.preferredLanguages.filter(l => l !== code) : [...s.preferredLanguages, code] }))} disabled={readonlyMode} className={`px-3 py-1 rounded-full border ${signUpData.preferredLanguages.includes(code) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{code}</button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Select at least one (used for editor communication).</p>
                        </div>

                        {/* Heard about NP */}
                        <div>
                          <label htmlFor="heardAbout" className="block font-medium mb-1">How did you hear about News Pulse? (optional)</label>
                          <input id="heardAbout" type="text" value={signUpData.heardAbout || ''} onChange={e => setSignUpData(s => ({ ...s, heardAbout: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                        </div>

                        {/* Reporter type toggle */}
                        <div>
                          <label className="block font-medium mb-2">I am</label>
                          <div className="flex flex-col md:flex-row gap-3">
                            <label className="inline-flex items-center gap-2">
                              <input type="radio" name="reporterType" checked={reporterType === 'community'} onChange={() => { setReporterType('community'); setSignUpData(s => ({ ...s, isProfessionalJournalist: false })); }} disabled={readonlyMode} />
                              <span>I am a Community Reporter</span>
                            </label>
                            {journalistApplicationsOpen ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="radio" name="reporterType" checked={reporterType === 'journalist'} onChange={() => { setReporterType('journalist'); setSignUpData(s => ({ ...s, isProfessionalJournalist: true })); }} disabled={readonlyMode} />
                                <span>I am a Professional Journalist / Media Person</span>
                              </label>
                            ) : (
                              <p className="text-xs text-gray-600 dark:text-gray-300">Journalist verification applications are currently closed.</p>
                            )}
                          </div>
                        </div>

                        {reporterType === 'community' && (
                          <div>
                            <label className="block font-medium mb-2">Beats / interests</label>
                            <div className="flex flex-wrap gap-2">
                              {COMMUNITY_INTERESTS.map(i => (
                                <button type="button" key={i} onClick={() => setSignUpData(s => ({ ...s, communityInterests: s.communityInterests.includes(i) ? s.communityInterests.filter(v => v !== i) : [...s.communityInterests, i] }))} disabled={readonlyMode} className={`px-3 py-1 rounded-full border ${signUpData.communityInterests.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{i}</button>
                              ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Helps route your tips to the right editor.</p>
                          </div>
                        )}

                        {reporterType === 'journalist' && (
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="organisationName" className="block font-medium mb-1">Organisation name *</label>
                              <input id="organisationName" type="text" value={signUpData.organisationName || ''} onChange={e => setSignUpData(s => ({ ...s, organisationName: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                              {errors.organisationName && <p className="text-red-600 text-xs mt-1">{errors.organisationName}</p>}
                            </div>
                            <div>
                              <label htmlFor="organisationType" className="block font-medium mb-1">Organisation type</label>
                              <select id="organisationType" value={signUpData.organisationType || ''} onChange={e => setSignUpData(s => ({ ...s, organisationType: (e.target.value || undefined) as ReporterSignUpState['organisationType'] }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2">
                                <option value="">Select type</option>
                                <option value="print">Print</option>
                                <option value="tv">TV</option>
                                <option value="radio">Radio</option>
                                <option value="digital">Digital</option>
                                <option value="freelance">Freelance</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor="positionTitle" className="block font-medium mb-1">Role / Title *</label>
                              <input id="positionTitle" type="text" value={signUpData.positionTitle || ''} onChange={e => setSignUpData(s => ({ ...s, positionTitle: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                              {errors.positionTitle && <p className="text-red-600 text-xs mt-1">{errors.positionTitle}</p>}
                            </div>
                            <div>
                              <label className="block font-medium mb-2">Primary beats</label>
                              <div className="flex flex-wrap gap-2">
                                {PROFESSIONAL_BEATS.map(beat => (
                                  <button type="button" key={beat} onClick={() => setSignUpData(s => ({ ...s, beatsProfessional: (s.beatsProfessional || []).includes(beat) ? (s.beatsProfessional || []).filter(b => b !== beat) : [ ...(s.beatsProfessional || []), beat ] }))} className={`px-3 py-1 rounded-full border ${(signUpData.beatsProfessional || []).includes(beat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{beat}</button>
                                ))}
                              </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="yearsExperience" className="block font-medium mb-1">Years of experience</label>
                                <select id="yearsExperience" value={signUpData.yearsExperience || ''} onChange={e => setSignUpData(s => ({ ...s, yearsExperience: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2">
                                  <option value="">Select range</option>
                                  <option value="0-1">0-1</option>
                                  <option value="2-4">2-4</option>
                                  <option value="5-9">5-9</option>
                                  <option value="10+">10+</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label htmlFor="professionalJournalistId" className="block font-medium mb-1">Professional ID (Press / Accreditation / Employee ID)</label>
                              <input id="professionalJournalistId" type="text" value={signUpData.professionalJournalistId || ''} onChange={e => setSignUpData(s => ({ ...s, professionalJournalistId: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            </div>

                            <div>
                              <label htmlFor="journalistIdFile" className="block font-medium mb-1">Upload ID proof (PDF/JPG/PNG)</label>
                              <input
                                id="journalistIdFile"
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                disabled={readonlyMode || !journalistApplicationsOpen}
                                onChange={(e) => {
                                  const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                  setJournalistIdFile(f);
                                  setJournalistIdUpload({ status: 'idle' });
                                }}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2"
                              />
                              {journalistIdUpload.status === 'uploading' && (
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Uploading…</p>
                              )}
                              {journalistIdUpload.status === 'success' && (
                                <p className="text-xs text-green-700 mt-1">Uploaded.</p>
                              )}
                              {journalistIdUpload.status === 'error' && (
                                <p className="text-xs text-red-600 mt-1">{journalistIdUpload.message || 'Upload failed.'}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Ethics / Charter */}
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <input id="consentToContact" type="checkbox" checked={signUpData.consentToContact} onChange={e => setSignUpData(s => ({ ...s, consentToContact: e.target.checked }))} disabled={readonlyMode} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" />
                            <label htmlFor="consentToContact" className="text-sm leading-relaxed">I consent to be contacted by the News Pulse editorial team about my submissions and reporter profile.</label>
                          </div>
                          <div className="flex items-start gap-3">
                            <input id="ethics" type="checkbox" checked={signUpData.generalEthicsAccepted} onChange={e => setSignUpData(s => ({ ...s, generalEthicsAccepted: e.target.checked }))} disabled={readonlyMode} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" />
                            <label htmlFor="ethics" className="text-sm leading-relaxed">I agree not to submit fake or unlawful stories and I accept that News Pulse may fact-check and reject my submissions.</label>
                          </div>
                          {errors.generalEthicsAccepted && <p className="text-red-600 text-xs -mt-2">{errors.generalEthicsAccepted}</p>}
                          {reporterType === 'journalist' && (
                            <div className="flex items-start gap-3">
                              <input id="charter" type="checkbox" checked={signUpData.journalistCharterAccepted} onChange={e => setSignUpData(s => ({ ...s, journalistCharterAccepted: e.target.checked }))} disabled={readonlyMode || !journalistApplicationsOpen} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" />
                              <label htmlFor="charter" className="text-sm leading-relaxed">I accept the News Pulse Journalist Charter and agree not to misuse the News Pulse name for threats, money, or favours.</label>
                            </div>
                          )}
                          {errors.journalistCharterAccepted && <p className="text-red-600 text-xs -mt-2">{errors.journalistCharterAccepted}</p>}
                          {reporterType === 'journalist' && (
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              Your details will be reviewed by the News Pulse editorial team before verification.
                            </p>
                          )}
                        </div>

                          {missingRecommendedProfileFields.length ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                              <p className="font-semibold">Profile incomplete (recommended)</p>
                              <p className="mt-1">Missing: {missingRecommendedProfileFields.join(', ')}.</p>
                              <p className="mt-1 text-xs">You can continue, but completing this helps editors verify and follow up.</p>
                            </div>
                          ) : null}

                        {/* Next */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => { if (validateStep1()) setStep(2); }}
                            disabled={readonlyMode || (reporterType === 'journalist' && (!journalistApplicationsOpen || !signUpData.journalistCharterAccepted))}
                            className={`w-full font-semibold px-6 py-3 rounded-lg transition-colors ${ (readonlyMode || (reporterType === 'journalist' && (!journalistApplicationsOpen || !signUpData.journalistCharterAccepted))) ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white' } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

            {step === 2 && (
              <>
                {/* Category */}
                <div>
                  <label htmlFor="category" className="block font-medium mb-1">Category *</label>
                  <select id="category" value={story.category} onChange={e => setStory(s => ({ ...s, category: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2">
                    <option value="">Select a category</option>
                    {categories.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </select>
                  {errors.category && <p className="text-red-600 text-xs mt-1">{errors.category}</p>}
                </div>

                {/* Coverage scope */}
                <div>
                  <label className="block font-medium mb-2">Coverage scope *</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="coverageScope"
                        checked={story.coverageScope === 'regional'}
                        onChange={() => setStory((s) => ({ ...s, coverageScope: 'regional' }))}
                        disabled={readonlyMode}
                      />
                      <span>Regional</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="coverageScope"
                        checked={story.coverageScope === 'national'}
                        onChange={() => setStory((s) => ({ ...s, coverageScope: 'national' }))}
                        disabled={readonlyMode}
                      />
                      <span>National</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="coverageScope"
                        checked={story.coverageScope === 'international'}
                        onChange={() => setStory((s) => ({ ...s, coverageScope: 'international' }))}
                        disabled={readonlyMode}
                      />
                      <span>International</span>
                    </label>
                  </div>
                  {errors.coverageScope && <p className="text-red-600 text-xs mt-1">{errors.coverageScope}</p>}
                </div>

                {/* Location (story-specific) */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="storyCity" className="block font-medium mb-1">Story city / area (where did this happen?)</label>
                    <input
                      id="storyCity"
                      type="text"
                      placeholder="e.g., Navrangpura, Ahmedabad"
                      value={story.storyCity || ''}
                      onChange={e => setStory(s => ({ ...s, storyCity: e.target.value }))}
                      disabled={readonlyMode}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="storyDistrict" className="block font-medium mb-1">District</label>
                    <input
                      id="storyDistrict"
                      type="text"
                      placeholder="e.g., Ahmedabad"
                      value={story.storyDistrict || ''}
                      onChange={e => setStory(s => ({ ...s, storyDistrict: e.target.value }))}
                      disabled={readonlyMode}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="storyState" className="block font-medium mb-1">State</label>
                    <input
                      id="storyState"
                      type="text"
                      placeholder="e.g., Gujarat"
                      value={story.storyState || ''}
                      onChange={e => setStory(s => ({ ...s, storyState: e.target.value }))}
                      disabled={readonlyMode}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="storyCountry" className="block font-medium mb-1">Country</label>
                    <input
                      id="storyCountry"
                      type="text"
                      placeholder="e.g., India"
                      value={story.storyCountry || ''}
                      onChange={e => setStory(s => ({ ...s, storyCountry: e.target.value }))}
                      disabled={readonlyMode}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2"
                    />
                  </div>
                </div>

                {/* Urgency toggle */}
                <div>
                  <label className="block font-medium mb-2">Is this urgent or time-sensitive?</label>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="priority"
                        checked={(story.priority || 'normal') === 'normal'}
                        onChange={() => setStory(s => ({ ...s, priority: 'normal' }))}
                        disabled={readonlyMode}
                      />
                      <span>Normal</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="priority"
                        checked={(story.priority || 'normal') === 'high'}
                        onChange={() => setStory(s => ({ ...s, priority: 'high' }))}
                        disabled={readonlyMode}
                      />
                      <span>Urgent</span>
                    </label>
                  </div>
                </div>

                {/* Headline */}
                <div>
                  <label htmlFor="headline" className="block font-medium mb-1">Headline *</label>
                  <input id="headline" type="text" maxLength={150} value={story.headline} onChange={e => setStory(s => ({ ...s, headline: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-500">Max 150 characters</p>
                    <p className="text-xs text-gray-500">{story.headline.length}/150</p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Keep it specific, avoid opinion or adjectives.</p>
                  {errors.headline && <p className="text-red-600 text-xs mt-1">{errors.headline}</p>}
                </div>

                {/* Story */}
                <div>
                  <label htmlFor="storyBody" className="block font-medium mb-1">Story *</label>
                  <textarea id="storyBody" rows={7} value={story.story} onChange={e => setStory(s => ({ ...s, story: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" placeholder="Describe the event, issue, or tip in detail..." />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-500">Minimum 50 characters</p>
                    <p className="text-xs text-gray-500">{story.story.trim().length} chars</p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Explain what happened, where, when, who is involved. Add only facts you are sure about.</p>
                  {errors.story && <p className="text-red-600 text-xs mt-1">{errors.story}</p>}
                </div>

                {/* Attachments placeholder */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                  <p className="font-semibold text-sm">Photos / documents (coming soon)</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">For now, describe visuals in your story. In future, you’ll be able to upload safely.</p>
                </div>

                {/* Age Group */}
                <div>
                  <label htmlFor="ageGroup" className="block font-medium mb-1">Age group *</label>
                  <select id="ageGroup" value={story.ageGroup} onChange={e => setStory(s => ({ ...s, ageGroup: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2">
                    <option value="">Select age group</option>
                    <option value="Under 18">Under 18</option>
                    <option value="18–24">18–24</option>
                    <option value="25–40">25–40</option>
                    <option value="41+">41+</option>
                  </select>
                  {errors.ageGroup && <p className="text-red-600 text-xs mt-1">{errors.ageGroup}</p>}
                </div>

                {/* Controls */}
                {/* Status messages */}
                {submitStatus === 'error' && (
                  <div className="mt-4 p-4 border border-red-300 bg-red-50 text-red-700 rounded-lg">
                    <p className="font-semibold">We couldn’t submit your story right now. Please try again in a few minutes.</p>
                    {submitError && <p className="text-xs mt-1">{submitError}</p>}
                  </div>
                )}

                    {submitStatus === 'success' && submitResult && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                    <p className="font-semibold">✅ Story submitted for review</p>
                    {submitResult.referenceId && (
                      <p className="mt-1">Your reference ID: {submitResult.referenceId}</p>
                    )}
                    <p className="mt-1">Status: Under review. Usually reviewed within 24–48 hours.</p>
                    <p className="mt-1 text-xs">
                      This confirmation is for your community submission record. Editorial publication decisions and live-site article visibility are handled separately.
                    </p>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => {
                          try { window.localStorage.setItem('np_cr_email', signUpData.email.trim().toLowerCase()); } catch {}
                          const target = `/community-reporter/my-stories?email=${encodeURIComponent(signUpData.email.trim().toLowerCase())}`;
                          router.push(target);
                        }}
                      >
                        View my submission records
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800"
                        onClick={() => {
                          setStory(initialStory);
                          setSubmitStatus('idle');
                          setSubmitResult(null);
                          setSubmitError(null);
                        }}
                      >
                        Submit another story
                      </button>
                    </div>

                    {missingRecommendedProfileFields.length ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <p className="font-semibold">Complete your reporter profile</p>
                        <p className="mt-1 text-sm">Missing: {missingRecommendedProfileFields.join(', ')}.</p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          onClick={() => {
                            setStep(1);
                            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                          }}
                        >
                          Complete profile now
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3 mt-4">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Back</button>
                  <button type="submit" disabled={readonlyMode || submitStatus === 'submitting'} className={`px-6 py-2 rounded-lg font-semibold ${(readonlyMode || submitStatus === 'submitting') ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>{submitStatus === 'submitting' ? 'Submitting…' : 'Submit Story'}</button>
                </div>
              </>
            )}

            <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
              Note: Nothing is auto-published. Every submission is reviewed manually for safety, ethics, and accuracy.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};

export default CommunityReporterPage;

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = async ({ locale }) => {
  const toggles = await fetchServerPublicFounderToggles();
  const { getMessages } = await import('../lib/getMessages');
  return { props: { communityReporterClosed: toggles.communityReporterClosed, reporterPortalClosed: toggles.reporterPortalClosed, messages: await getMessages(locale as string) } };
};
