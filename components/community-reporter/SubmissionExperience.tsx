import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { SubmitCommunityStoryResult } from '../../src/lib/communityReporterApi';
import { useCommunityReporterConfig } from '../../src/hooks/useCommunityReporterConfig';
import { usePublicMode } from '../../utils/PublicModeProvider';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { COMMUNITY_REPORTER_CATEGORY_OPTIONS, COMMUNITY_REPORTER_CATEGORY_PLACEHOLDER } from '../../lib/communityReporterCategories';
import type { FeatureToggleProps } from '../../types/community-reporter';

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
  category: string;
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

type Props = FeatureToggleProps & {
  variant?: 'public' | 'portal';
  initialEmail?: string | null;
};

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

const LANG_OPTIONS = ['en', 'hi', 'gu'];
const COMMUNITY_INTERESTS = ['Local issues', 'Youth', 'Politics', 'Civic', 'Education', 'Health', 'Environment', 'Sports', 'Culture'];
const PROFESSIONAL_BEATS = ['Politics', 'Crime', 'Business', 'Education', 'Civic', 'Sports', 'Entertainment', 'Tech', 'Other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_NUMBER_REGEX = /^[+]?[-()\s0-9]{7,20}$/;

function normalizeContactNumber(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isValidContactNumber(value: string): boolean {
  const normalized = normalizeContactNumber(value);
  if (!normalized) return true;
  const digitsOnly = normalized.replace(/\D/g, '');
  return CONTACT_NUMBER_REGEX.test(normalized) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export default function SubmissionExperience({
  communityReporterClosed,
  reporterPortalClosed,
  variant = 'public',
  initialEmail,
}: Props) {
  const router = useRouter();
  const { readOnly } = usePublicMode();
  const { toggles: liveToggles } = usePublicFounderToggles({
    communityReporterClosed,
    reporterPortalClosed,
    youthPulseSubmissionsClosed: false,
    updatedAt: null,
  });
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
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitCommunityStoryResult | null>(null);
  const { config } = useCommunityReporterConfig();
  const myStoriesEnabledLegacy = config?.communityMyStoriesEnabled ?? true;
  const [settings, setSettings] = useState<{
    communityReporterEnabled: boolean;
    allowNewSubmissions: boolean;
    allowMyStoriesPortal: boolean;
    allowJournalistApplications: boolean;
  } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const effectiveCommunityReporterClosed = liveToggles.communityReporterClosed;
  const effectiveReporterPortalClosed = liveToggles.reporterPortalClosed;
  const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE || '').toString().trim().replace(/\/+$/, '');
  const [reporterAccountId, setReporterAccountId] = useState<string>('');
  const { session } = useReporterPortalSession();

  const isPortalView = variant === 'portal';
  const portalTrackHref = '/reporter/submissions';
  const portalLoginHref = '/reporter/login';
  const portalTrackEntryHref = session?.email ? portalTrackHref : `${portalLoginHref}?next=${encodeURIComponent(portalTrackHref)}`;

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
      window.localStorage.removeItem('np_cr_profile_v1');
      window.localStorage.removeItem('np_cr_email');
      window.localStorage.removeItem('np_communityReporterEmail');
      window.localStorage.removeItem('np_communityReporterId');
      if (opts?.startFresh) {
        window.localStorage.removeItem('np_cr_account_id_v1');
      }
    } catch {}

    setSavedDetailsRestoredFromStorage(false);
    setHasSavedDetailsInStorage(false);
    skipNextProfilePersistRef.current = true;

    if (opts?.startFresh) {
      setReporterType('community');
      setSignUpData({ ...initialSignUp, email: String(initialEmail || '').trim().toLowerCase() });
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
      setSignUpData((current) => ({ ...current }));
    }
  };

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
      setSignUpData((current) => ({
        ...current,
        fullName: typeof parsed.fullName === 'string' ? parsed.fullName : current.fullName,
        email: typeof parsed.email === 'string' ? parsed.email : current.email,
        phone: typeof parsed.phone === 'string' ? parsed.phone : current.phone,
        whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : current.whatsapp,
        city: typeof parsed.city === 'string' ? parsed.city : current.city,
        district: typeof parsed.district === 'string' ? parsed.district : current.district,
        state: typeof parsed.state === 'string' ? parsed.state : current.state,
        country: typeof parsed.country === 'string' ? parsed.country : current.country,
        preferredLanguages: Array.isArray(parsed.preferredLanguages) ? parsed.preferredLanguages : current.preferredLanguages,
        communityInterests: Array.isArray(parsed.communityInterests) ? parsed.communityInterests : current.communityInterests,
        consentToContact: typeof parsed.consentToContact === 'boolean' ? parsed.consentToContact : current.consentToContact,
      }));
    } catch {}
  }, [initialEmail]);

  useEffect(() => {
    const normalizedInitialEmail = String(initialEmail || '').trim().toLowerCase();
    if (!normalizedInitialEmail) return;
    setSignUpData((current) => (current.email.trim() ? current : { ...current, email: normalizedInitialEmail }));
  }, [initialEmail]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (typeof window === 'undefined') return;
        if (skipNextProfilePersistRef.current) {
          skipNextProfilePersistRef.current = false;
          return;
        }
        window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({
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
        }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [signUpData]);

  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
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
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL]);

  const myStoriesEnabled = settings ? Boolean(settings.allowMyStoriesPortal) : myStoriesEnabledLegacy;
  const readonlyMode = settings ? (settings.communityReporterEnabled === true && settings.allowNewSubmissions === false) : false;
  const journalistApplicationsOpen = settings ? Boolean(settings.allowJournalistApplications) : true;
  const effectiveReadOnly = readOnly || readonlyMode;

  const missingRecommendedProfileFields = useMemo(() => {
    const missing: string[] = [];
    if (!signUpData.email.trim()) missing.push('email');
    if (!signUpData.phone.trim()) missing.push('phone');
    if (!signUpData.city.trim()) missing.push('city');
    if (!signUpData.district.trim()) missing.push('district');
    if (!signUpData.state.trim()) missing.push('state');
    if (!signUpData.country.trim()) missing.push('country');
    if (!signUpData.preferredLanguages.length) missing.push('preferred language');
    if (!signUpData.communityInterests.length && reporterType === 'community') missing.push('beats');
    if (!signUpData.consentToContact) missing.push('consent to contact');
    return missing;
  }, [reporterType, signUpData]);

  const validateStep1 = () => {
    const nextErrors: Record<string, string> = {};
    if (!signUpData.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    const hasEmail = Boolean(signUpData.email.trim());
    if (!hasEmail) nextErrors.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(signUpData.email.trim())) nextErrors.email = 'Enter a valid email.';
    if (!isValidContactNumber(signUpData.phone)) nextErrors.phone = 'Enter a valid phone number.';
    if (!isValidContactNumber(signUpData.whatsapp)) nextErrors.whatsapp = 'Enter a valid WhatsApp number.';
    if (!signUpData.generalEthicsAccepted) nextErrors.generalEthicsAccepted = 'You must accept ethics policy.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = () => {
    const nextErrors: Record<string, string> = {};
    if (!story.ageGroup) nextErrors.ageGroup = 'Select an age group.';
    if (!story.category) nextErrors.category = 'Select a category.';
    if (!story.coverageScope) nextErrors.coverageScope = 'Select a coverage scope.';
    if (!story.headline.trim()) nextErrors.headline = 'Headline is required.';
    if (story.headline.length > 150) nextErrors.headline = 'Headline exceeds 150 characters.';
    if (!story.story.trim()) nextErrors.story = 'Story is required.';
    else if (story.story.trim().length < 50) nextErrors.story = 'Story must be at least 50 characters.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

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
      let uploadedIdFileId: string | undefined;
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

      const normalizedPhone = normalizeContactNumber(signUpData.phone);
      const normalizedWhatsApp = normalizeContactNumber(signUpData.whatsapp);
      const normalizedCity = signUpData.city.trim();
      const normalizedDistrict = signUpData.district.trim();
      const normalizedState = signUpData.state.trim();
      const normalizedCountry = signUpData.country.trim();
      const selectedBeats = reporterType === 'community' ? signUpData.communityInterests : (signUpData.beatsProfessional || []);

      const payload = {
        reporterAccountId: reporterAccountId || undefined,
        reporterProfileId: storedReporterProfileId || undefined,
        reporterType,
        consentToContact: Boolean(signUpData.consentToContact),
        reporterName: signUpData.fullName.trim(),
        reporterEmail: signUpData.email.trim(),
        reporterPhone: normalizedPhone,
        reporterWhatsApp: normalizedWhatsApp,
        fullName: signUpData.fullName.trim(),
        phone: normalizedPhone || undefined,
        whatsapp: normalizedWhatsApp || undefined,
        reporterCity: normalizedCity,
        reporterDistrict: normalizedDistrict,
        reporterState: normalizedState,
        reporterCountry: normalizedCountry,
        city: normalizedCity || undefined,
        district: normalizedDistrict || undefined,
        state: normalizedState || undefined,
        country: normalizedCountry || undefined,
        preferredLanguages: signUpData.preferredLanguages,
        beats: selectedBeats,
        beat: selectedBeats[0] || undefined,
        beatAreas: selectedBeats,
        heardAbout: (signUpData.heardAbout || '').trim() || undefined,
        organisationName: (signUpData.organisationName || '').trim() || undefined,
        organisationType: signUpData.organisationType || undefined,
        positionTitle: (signUpData.positionTitle || '').trim() || undefined,
        beatsProfessional: signUpData.beatsProfessional || undefined,
        communityInterests: reporterType === 'community' ? signUpData.communityInterests : undefined,
        yearsExperience: (signUpData.yearsExperience || '').trim() || undefined,
        professionalJournalistId: (signUpData.professionalJournalistId || '').trim() || undefined,
        journalistCharterAccepted: Boolean(signUpData.journalistCharterAccepted),
        generalEthicsAccepted: Boolean(signUpData.generalEthicsAccepted),
        journalistIdFileId: uploadedIdFileId || undefined,
        category: story.category,
        coverageScope: story.coverageScope,
        coverageType: story.coverageScope || undefined,
        headline: story.headline.trim(),
        storyText: story.story.trim(),
        ageGroup: story.ageGroup,
        priority: story.priority || 'normal',
        mediaLink: (story.mediaLink || '').trim() || undefined,
        storyCity: (story.storyCity || '').trim() || undefined,
        storyDistrict: (story.storyDistrict || '').trim() || undefined,
        storyState: (story.storyState || '').trim() || undefined,
        storyCountry: (story.storyCountry || '').trim() || undefined,
        name: signUpData.fullName.trim(),
        email: signUpData.email.trim(),
        area: location || undefined,
        location,
        story: story.story.trim(),
        reporterProfile: {
          fullName: signUpData.fullName.trim(),
          email: signUpData.email.trim(),
          phone: normalizedPhone,
          whatsapp: normalizedWhatsApp,
          city: normalizedCity,
          district: normalizedDistrict,
          state: normalizedState,
          country: normalizedCountry,
          preferredLanguages: signUpData.preferredLanguages,
          beats: selectedBeats,
          consentToContact: Boolean(signUpData.consentToContact),
          reporterType,
        },
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
        } catch {}
        // eslint-disable-next-line no-console
        console.error('Community Reporter submit failed:', res.status, data);
        const msg = data?.message || 'We couldn’t submit your story right now. Please try again in a few minutes.';
        setSubmitError(msg);
        setSubmitStatus('error');
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      const storyId = data?.storyId || data?.id || data?.reference || data?.referenceId || '';
      const reporterId = data?.reporterId || data?.reporter?.id || '';
      const reporterEmail = data?.reporterEmail || data?.reporter?.email || signUpData.email?.trim();
      try {
        if (typeof window !== 'undefined') {
          if (reporterId) window.localStorage.setItem('np_communityReporterId', String(reporterId));
          if (reporterEmail) {
            window.localStorage.setItem('np_communityReporterEmail', String(reporterEmail));
            window.localStorage.setItem('np_cr_email', String(reporterEmail).trim().toLowerCase());
          }
        }
      } catch {}

      setSubmitResult({
        ok: true,
        referenceId: String(storyId || ''),
        status: data?.status || 'Under review',
        reporterType,
      });
      setSubmitStatus('success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[community-reporter submit] exception', err);
      setSubmitError('We couldn’t submit your story right now. Please try again in a few minutes.');
      setSubmitStatus('error');
    } finally {
      submitInFlightRef.current = false;
    }
  };

  if (effectiveCommunityReporterClosed) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-dark-primary dark:text-dark-text">
        <Head>
          <title>Community Reporter – Temporarily Closed | News Pulse</title>
        </Head>
        <section className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-16 dark:from-gray-800 dark:to-gray-900">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-4xl font-black text-transparent md:text-5xl">News Pulse Community Reporter</h1>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl">Temporarily closed. Please check back soon.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (settingsLoading && !settings) {
    return <div className="grid min-h-screen place-items-center bg-white text-black dark:bg-dark-primary dark:text-dark-text"><p className="text-sm text-gray-700 dark:text-gray-300">Loading settings…</p></div>;
  }

  if (settings && !settings.communityReporterEnabled) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-dark-primary dark:text-dark-text">
        <Head>
          <title>Community Reporter – Currently Unavailable | News Pulse</title>
        </Head>
        <section className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-16 dark:from-gray-800 dark:to-gray-900">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-4xl font-black text-transparent md:text-5xl">News Pulse Community Reporter</h1>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl">The Community Reporter program is currently not available. Please check again later.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const successTarget = isPortalView ? '/reporter/dashboard' : portalTrackEntryHref;

  return (
    <div className="min-h-screen bg-white text-black dark:bg-dark-primary dark:text-dark-text">
      <Head>
        <title>{`${isPortalView ? 'Reporter Portal – Submit Story' : 'Community Reporter – Submit Your Story'} | News Pulse`}</title>
        <meta name="description" content={isPortalView ? 'Submit a community story from the News Pulse Reporter Portal.' : 'Submit your story to News Pulse.'} />
      </Head>

      <section className={`relative bg-gradient-to-br from-blue-50 to-indigo-50 px-4 ${isPortalView ? 'py-10' : 'py-16'} dark:from-gray-800 dark:to-gray-900`}>
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-4xl font-black text-transparent md:text-5xl">{isPortalView ? 'Reporter Portal Story Desk' : 'News Pulse Community Reporter'}</h1>
          <p className="mb-6 text-lg leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl">
            {isPortalView ? 'Send a verified story straight into the same News Pulse community reporter review workflow. This portal keeps your public submission form and your logged-in tracking experience separate.' : 'Share impactful local stories, emerging issues, campus updates, and verified tips. Every submission is manually reviewed by our editorial team before publishing.'}
          </p>

          {isPortalView ? (
            <div className="mb-6 flex flex-wrap gap-3">
              <Link href="/reporter/dashboard" className="rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-white/80">Back to dashboard</Link>
              <Link href="/reporter/submissions" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Track my submissions</Link>
            </div>
          ) : (
            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <Link href={portalLoginHref} className="rounded-2xl border border-blue-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"><div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Reporter Portal</div><div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">Login to Reporter Portal</div><div className="mt-1 text-sm text-gray-600 dark:text-gray-300">Use your reporter email to open your dashboard, profile, and submission tools.</div></Link>
              <Link href="#submit-form" className="rounded-2xl border border-blue-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"><div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Submission</div><div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">Submit a Story</div><div className="mt-1 text-sm text-gray-600 dark:text-gray-300">Use the public form below if you want to send a story without entering the portal first.</div></Link>
            </div>
          )}

          {!isPortalView && !effectiveReporterPortalClosed && myStoriesEnabled ? <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">Already submitted? <Link href={portalTrackEntryHref} className="font-semibold text-blue-700 hover:underline">Track your submissions</Link></div> : null}

          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-xl font-semibold">Submission Guidelines</h2>
            <ul className="ml-5 list-disc space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>No hate speech or discriminatory content.</li>
              <li>No intentionally false or misleading information.</li>
              <li>No personal attacks, harassment, or doxxing.</li>
              <li>Respect privacy and safety; blur sensitive personal data.</li>
              <li>Campus and youth stories must be authentic and respectful.</li>
            </ul>
          </div>

          <div className="px-4"><div className="mx-auto mb-4 flex max-w-3xl items-center justify-between"><div className="flex items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Step 1: Reporter Details</span><span className={`rounded-full px-3 py-1 ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Step 2: Submit Your Story</span></div></div></div>
        </div>
      </section>

      {effectiveReadOnly && submitStatus !== 'success' ? <section className="px-4 py-10"><div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-3 text-xl font-semibold">Read-Only Mode</h2><p className="text-gray-700 dark:text-gray-300">Submissions are temporarily paused due to maintenance or policy updates.</p><div className="mt-4 flex flex-wrap gap-3">{isPortalView ? <Link href={portalTrackHref} className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">View My Submissions</Link> : myStoriesEnabled ? <Link href={portalLoginHref} className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Login to Reporter Portal</Link> : null}</div></div></section> : null}

      <section id="submit-form" className="px-4 py-10"><div className="mx-auto max-w-3xl"><form onSubmit={step === 1 ? undefined : handleSubmitStep2} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-2 text-2xl font-bold">{step === 1 ? 'Reporter Details' : 'Submit Your Story'}</h2><div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Shared submission flow: both the public page and Reporter Portal send stories into the same existing community reporter system.</div>{step === 1 ? (<div className="space-y-6 border-b border-gray-200 pb-6 dark:border-gray-700"><div>{(savedDetailsRestoredFromStorage || hasSavedDetailsInStorage) ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">Using saved reporter details</p><p className="mt-0.5 text-xs">These details were restored from this browser.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800" onClick={() => clearSavedReporterDetails({ startFresh: false })}>Clear saved details</button><button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => clearSavedReporterDetails({ startFresh: true })}>Start fresh</button></div></div></div> : null}</div><div><label htmlFor="fullName" className="mb-1 block font-medium">Full name *</label><input id="fullName" type="text" value={signUpData.fullName} onChange={(e) => setSignUpData((current) => ({ ...current, fullName: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" />{errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}</div><div><label htmlFor="email" className="mb-1 block font-medium">Email *</label><input id="email" type="email" value={signUpData.email} onChange={(e) => setSignUpData((current) => ({ ...current, email: e.target.value }))} disabled={readonlyMode || Boolean(isPortalView && initialEmail)} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" />{errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}</div><div><label htmlFor="phone" className="mb-1 block font-medium">Phone (recommended)</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={signUpData.phone} onChange={(e) => setSignUpData((current) => ({ ...current, phone: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" />{errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}<p className="mt-1 text-xs text-gray-500">Recommended for editor follow-up and directory enrichment. Never shown publicly.</p></div><div><label htmlFor="whatsapp" className="mb-1 block font-medium">WhatsApp (optional)</label><input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" value={signUpData.whatsapp} onChange={(e) => setSignUpData((current) => ({ ...current, whatsapp: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" />{errors.whatsapp ? <p className="mt-1 text-xs text-red-600">{errors.whatsapp}</p> : null}</div><div className="grid gap-4 md:grid-cols-2"><div><label htmlFor="city" className="mb-1 block font-medium">City</label><input id="city" type="text" value={signUpData.city} onChange={(e) => setSignUpData((current) => ({ ...current, city: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" /></div><div><label htmlFor="district" className="mb-1 block font-medium">District</label><input id="district" type="text" value={signUpData.district} onChange={(e) => setSignUpData((current) => ({ ...current, district: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" /></div><div><label htmlFor="state" className="mb-1 block font-medium">State</label><input id="state" type="text" value={signUpData.state} onChange={(e) => setSignUpData((current) => ({ ...current, state: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" /></div><div><label htmlFor="country" className="mb-1 block font-medium">Country</label><input id="country" type="text" value={signUpData.country} onChange={(e) => setSignUpData((current) => ({ ...current, country: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" /></div></div><div><label className="mb-2 block font-medium">Preferred languages</label><div className="flex flex-wrap gap-2">{LANG_OPTIONS.map((code) => <button type="button" key={code} onClick={() => setSignUpData((current) => ({ ...current, preferredLanguages: current.preferredLanguages.includes(code) ? current.preferredLanguages.filter((item) => item !== code) : [...current.preferredLanguages, code] }))} disabled={readonlyMode} className={`rounded-full border px-3 py-1 ${signUpData.preferredLanguages.includes(code) ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'}`}>{code}</button>)}</div></div><div><label htmlFor="heardAbout" className="mb-1 block font-medium">How did you hear about News Pulse? (optional)</label><input id="heardAbout" type="text" value={signUpData.heardAbout || ''} onChange={(e) => setSignUpData((current) => ({ ...current, heardAbout: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" /></div><div><label className="mb-2 block font-medium">I am</label><div className="flex flex-col gap-3 md:flex-row"><label className="inline-flex items-center gap-2"><input type="radio" name="reporterType" checked={reporterType === 'community'} onChange={() => { setReporterType('community'); setSignUpData((current) => ({ ...current, isProfessionalJournalist: false })); }} disabled={readonlyMode} /><span>I am a Community Reporter</span></label>{journalistApplicationsOpen ? <label className="inline-flex items-center gap-2"><input type="radio" name="reporterType" checked={reporterType === 'journalist'} onChange={() => { setReporterType('journalist'); setSignUpData((current) => ({ ...current, isProfessionalJournalist: true })); }} disabled={readonlyMode} /><span>I am a Professional Journalist / Media Person</span></label> : <p className="text-xs text-gray-600 dark:text-gray-300">Journalist verification applications are currently closed.</p>}</div></div>{reporterType === 'community' ? <div><label className="mb-2 block font-medium">Beats / interests</label><div className="flex flex-wrap gap-2">{COMMUNITY_INTERESTS.map((item) => <button type="button" key={item} onClick={() => setSignUpData((current) => ({ ...current, communityInterests: current.communityInterests.includes(item) ? current.communityInterests.filter((value) => value !== item) : [...current.communityInterests, item] }))} disabled={readonlyMode} className={`rounded-full border px-3 py-1 ${signUpData.communityInterests.includes(item) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'}`}>{item}</button>)}</div></div> : null}<div className="space-y-3"><div className="flex items-start gap-3"><input id="consentToContact" type="checkbox" checked={signUpData.consentToContact} onChange={(e) => setSignUpData((current) => ({ ...current, consentToContact: e.target.checked }))} disabled={readonlyMode} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" /><label htmlFor="consentToContact" className="text-sm leading-relaxed">I consent to be contacted by the News Pulse editorial team about my submissions and reporter profile.</label></div><div className="flex items-start gap-3"><input id="ethics" type="checkbox" checked={signUpData.generalEthicsAccepted} onChange={(e) => setSignUpData((current) => ({ ...current, generalEthicsAccepted: e.target.checked }))} disabled={readonlyMode} className="mt-1 h-5 w-5 rounded border-gray-300 focus:ring-blue-500" /><label htmlFor="ethics" className="text-sm leading-relaxed">I agree not to submit fake or unlawful stories and I accept that News Pulse may fact-check and reject my submissions.</label></div></div>{missingRecommendedProfileFields.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-semibold">Profile incomplete (recommended)</p><p className="mt-1">Missing: {missingRecommendedProfileFields.join(', ')}.</p><p className="mt-1 text-xs">You can continue, but completing this helps editors verify and follow up.</p></div> : null}<div className="pt-2"><button type="button" onClick={() => { if (validateStep1()) setStep(2); }} disabled={readonlyMode} className={`w-full rounded-lg px-6 py-3 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${readonlyMode ? 'cursor-not-allowed bg-gray-400 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Next</button></div></div>) : (<><div><label htmlFor="category" className="mb-1 block font-medium">Category *</label><select id="category" value={story.category} onChange={(e) => setStory((current) => ({ ...current, category: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"><option value="">{COMMUNITY_REPORTER_CATEGORY_PLACEHOLDER}</option>{COMMUNITY_REPORTER_CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div><div><label className="mb-2 block font-medium">Coverage scope *</label><div className="flex flex-wrap items-center gap-4">{['regional', 'national', 'international'].map((scope) => <label key={scope} className="inline-flex items-center gap-2"><input type="radio" name="coverageScope" checked={story.coverageScope === scope} onChange={() => setStory((current) => ({ ...current, coverageScope: scope as StoryFormState['coverageScope'] }))} disabled={readonlyMode} /><span>{scope.charAt(0).toUpperCase() + scope.slice(1)}</span></label>)}</div>{errors.coverageScope ? <p className="mt-1 text-xs text-red-600">{errors.coverageScope}</p> : null}</div><div><label htmlFor="headline" className="mb-1 block font-medium">Headline *</label><input id="headline" type="text" maxLength={150} value={story.headline} onChange={(e) => setStory((current) => ({ ...current, headline: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700" />{errors.headline ? <p className="mt-1 text-xs text-red-600">{errors.headline}</p> : null}</div><div><label htmlFor="storyBody" className="mb-1 block font-medium">Story *</label><textarea id="storyBody" rows={7} value={story.story} onChange={(e) => setStory((current) => ({ ...current, story: e.target.value }))} disabled={readonlyMode} className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700" placeholder="Describe the event, issue, or tip in detail..." />{errors.story ? <p className="mt-1 text-xs text-red-600">{errors.story}</p> : null}</div><div><label htmlFor="ageGroup" className="mb-1 block font-medium">Age group *</label><select id="ageGroup" value={story.ageGroup} onChange={(e) => setStory((current) => ({ ...current, ageGroup: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"><option value="">Select age group</option><option value="Under 18">Under 18</option><option value="18–24">18–24</option><option value="25–40">25–40</option><option value="41+">41+</option></select>{errors.ageGroup ? <p className="mt-1 text-xs text-red-600">{errors.ageGroup}</p> : null}</div>{submitStatus === 'error' ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700"><p className="font-semibold">We couldn’t submit your story right now. Please try again in a few minutes.</p>{submitError ? <p className="mt-1 text-xs">{submitError}</p> : null}</div> : null}{submitStatus === 'success' && submitResult ? <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"><p className="font-semibold">Story submitted for review</p>{submitResult.referenceId ? <p className="mt-1">Your reference ID: {submitResult.referenceId}</p> : null}<p className="mt-1">Status: Under review. Usually reviewed within 24–48 hours.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700" onClick={() => router.push(successTarget)}>{isPortalView ? 'View my dashboard' : 'Track your submissions'}</button><button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800" onClick={() => { setStory(initialStory); setSubmitStatus('idle'); setSubmitResult(null); setSubmitError(null); }}>Submit another story</button></div></div> : null}<div className="mt-4 flex items-center gap-3"><button type="button" onClick={() => setStep(1)} className="rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600">Back</button><button type="submit" disabled={readonlyMode || submitStatus === 'submitting'} className={`rounded-lg px-6 py-2 font-semibold ${(readonlyMode || submitStatus === 'submitting') ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{submitStatus === 'submitting' ? 'Submitting…' : 'Submit Story'}</button></div></>)}</form></div></section>
    </div>
  );
}