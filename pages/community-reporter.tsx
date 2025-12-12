import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { submitCommunityStory, SubmitCommunityStoryResult } from '../src/lib/communityReporterApi';
import { useCommunityReporterConfig } from '../src/hooks/useCommunityReporterConfig';

// Phase 1 Community Reporter Submission Page
// Route: /community-reporter

type ReporterType = 'community' | 'journalist';

interface ReporterSignUpState {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  preferredLanguages: string[];
  heardAbout?: string;
  isProfessionalJournalist: boolean;
  communityInterests: string[];
  organisationName?: string;
  organisationType?: 'print' | 'tv' | 'radio' | 'digital' | 'freelance' | 'other';
  positionTitle?: string;
  beatsProfessional?: string[];
  yearsExperience?: string;
  websiteOrPortfolio?: string;
  linkedin?: string;
  twitter?: string;
  journalistCharterAccepted: boolean;
  generalEthicsAccepted: boolean;
}

interface StoryFormState {
  ageGroup: string;
  category: string; // Stores slug value e.g. 'regional'
  headline: string;
  story: string;
  mediaLink?: string;
}

const initialSignUp: ReporterSignUpState = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  country: 'India',
  preferredLanguages: [],
  heardAbout: '',
  isProfessionalJournalist: false,
  communityInterests: [],
  organisationName: '',
  organisationType: undefined,
  positionTitle: '',
  beatsProfessional: [],
  yearsExperience: '',
  websiteOrPortfolio: '',
  linkedin: '',
  twitter: '',
  journalistCharterAccepted: false,
  generalEthicsAccepted: false,
};

const initialStory: StoryFormState = {
  ageGroup: '',
  category: '',
  headline: '',
  story: '',
  mediaLink: '',
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
  const [step, setStep] = useState<1 | 2>(1);
  const [reporterType, setReporterType] = useState<ReporterType>('community');
  const [signUpData, setSignUpData] = useState<ReporterSignUpState>(initialSignUp);
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

  // Public backend base URL (env override -> fallback)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://newspulse-backend-real.onrender.com';

  // Fetch public community settings on mount
  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsError(null);
    fetch('/api/public/community/settings', { headers: { Accept: 'application/json' } })
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

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!signUpData.fullName.trim()) e.fullName = 'Full name is required.';
    if (!signUpData.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpData.email)) e.email = 'Enter a valid email.';
    if (!signUpData.phone.trim()) e.phone = 'Phone is required.';
    if (!signUpData.city.trim()) e.city = 'City is required.';
    if (!signUpData.state.trim()) e.state = 'State is required.';
    if (!signUpData.country.trim()) e.country = 'Country is required.';
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
    if (!story.headline.trim()) e.headline = 'Headline is required.';
    if (story.headline.length > 150) e.headline = 'Headline exceeds 150 characters.';
    if (!story.story.trim()) e.story = 'Story is required.';
    else if (story.story.trim().length < 50) e.story = 'Story must be at least 50 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitStep2: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitResult(null);
    setSubmitStatus('idle');
    if (!validateStep2()) return;
    setSubmitStatus('submitting');
    try {
      const payload = {
        reporter: {
          fullName: signUpData.fullName.trim(),
          email: signUpData.email.trim(),
          phone: signUpData.phone.trim(),
          city: signUpData.city.trim(),
          state: signUpData.state.trim(),
          country: signUpData.country.trim(),
          preferredLanguages: signUpData.preferredLanguages,
          heardAbout: signUpData.heardAbout?.trim() || '',
          reporterType: reporterType === 'journalist' ? 'journalist' : 'community',
          beats: signUpData.beatsProfessional || [],
          agreesToEthics: signUpData.generalEthicsAccepted === true,
        },
        story: {
          category: story.category,
          headline: story.headline.trim(),
          body: story.story.trim(),
          ageGroup: story.ageGroup,
          locationCity: signUpData.city.trim(),
          locationState: signUpData.state.trim(),
          urgency: 'normal',
          canContact: true,
        },
        // Additional reporter fields for verification of professional journalists
        isProfessional: reporterType === 'journalist',
        organisation: (signUpData.organisationName || '').trim(),
        roleOrTitle: (signUpData.positionTitle || '').trim(),
        yearsExperience: (signUpData.yearsExperience || '').trim(),
        portfolioLinks: (signUpData.websiteOrPortfolio || '').trim(),
        agreedToJournalistCharter: signUpData.journalistCharterAccepted === true,
      };
      const res = await fetch('/api/community-reporter/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json().catch(() => ({}));
      const ok = res.ok && (data?.ok === true);
      if (ok) {
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
      } else {
        const msg = data?.message || 'We couldn’t submit your story right now. Please try again in a few minutes.';
        setSubmitError(msg);
        setSubmitStatus('error');
      }
    } catch (err) {
      setSubmitError('We couldn’t submit your story right now. Please try again in a few minutes.');
      setSubmitStatus('error');
    } finally {
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
              <Link href="/community-reporter/my-stories" className="text-sm text-blue-700 hover:underline">
                Already submitted stories? View My Community Stories
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
            {readonlyMode && (
              <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                Submissions are temporarily paused. You can still read about the program below.
              </div>
            )}
                    {step === 1 && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 -mt-1 mb-2">
                        Working journalist? Select 'Professional Journalist' above to share your press details for verification.
                      </p>
                    )}
                    {step === 1 && (
                      <div className="space-y-6 border-b border-gray-200 dark:border-gray-700 pb-6">
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
                          <label htmlFor="phone" className="block font-medium mb-1">Phone *</label>
                          <input id="phone" type="tel" value={signUpData.phone} onChange={e => setSignUpData(s => ({ ...s, phone: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                          {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
                          <p className="text-xs text-gray-500 mt-1">For verification only, never shown publicly.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="city" className="block font-medium mb-1">City *</label>
                            <input id="city" type="text" value={signUpData.city} onChange={e => setSignUpData(s => ({ ...s, city: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            {errors.city && <p className="text-red-600 text-xs mt-1">{errors.city}</p>}
                          </div>
                          <div>
                            <label htmlFor="state" className="block font-medium mb-1">State *</label>
                            <input id="state" type="text" value={signUpData.state} onChange={e => setSignUpData(s => ({ ...s, state: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                            {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
                          </div>
                          <div>
                            <label htmlFor="country" className="block font-medium mb-1">Country *</label>
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
                            <label className="block font-medium mb-2">What kind of stories are you interested in?</label>
                            <div className="flex flex-wrap gap-2">
                              {COMMUNITY_INTERESTS.map(i => (
                                <button type="button" key={i} onClick={() => setSignUpData(s => ({ ...s, communityInterests: s.communityInterests.includes(i) ? s.communityInterests.filter(v => v !== i) : [...s.communityInterests, i] }))} disabled={readonlyMode} className={`px-3 py-1 rounded-full border ${signUpData.communityInterests.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>{i}</button>
                              ))}
                            </div>
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
                              <div>
                                <label htmlFor="websiteOrPortfolio" className="block font-medium mb-1">Portfolio / clips link(s)</label>
                                <input id="websiteOrPortfolio" type="url" value={signUpData.websiteOrPortfolio || ''} onChange={e => setSignUpData(s => ({ ...s, websiteOrPortfolio: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                              </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="linkedin" className="block font-medium mb-1">LinkedIn</label>
                                <input id="linkedin" type="url" value={signUpData.linkedin || ''} onChange={e => setSignUpData(s => ({ ...s, linkedin: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                              </div>
                              <div>
                                <label htmlFor="twitter" className="block font-medium mb-1">Twitter / X</label>
                                <input id="twitter" type="url" value={signUpData.twitter || ''} onChange={e => setSignUpData(s => ({ ...s, twitter: e.target.value }))} disabled={readonlyMode || !journalistApplicationsOpen} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Ethics / Charter */}
                        <div className="space-y-3">
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

                {/* Headline */}
                <div>
                  <label htmlFor="headline" className="block font-medium mb-1">Headline *</label>
                  <input id="headline" type="text" maxLength={150} value={story.headline} onChange={e => setStory(s => ({ ...s, headline: e.target.value }))} disabled={readonlyMode} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-500">Max 150 characters</p>
                    <p className="text-xs text-gray-500">{story.headline.length}/150</p>
                  </div>
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
                  {errors.story && <p className="text-red-600 text-xs mt-1">{errors.story}</p>}
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
                    <p className="mt-1">Our editorial team will manually verify it before publishing.</p>
                    {submitResult.referenceId && (
                      <p className="mt-1"><span className="font-semibold">Reference ID:</span> {submitResult.referenceId}</p>
                    )}
                    <p className="mt-2 text-xs text-green-900/80">You can track this and your other stories from the 'My Community Stories' page.</p>
                    <div className="mt-2 text-xs text-green-900/80 space-y-1">
                      <p>Reporter type: {submitResult.reporterType === 'journalist' ? 'Professional Journalist / Media' : 'Community Reporter'}</p>
                      <p>Status: {submitResult.status || 'Under review'}</p>
                    </div>
                    <div className="mt-3 flex gap-3">
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
                      {myStoriesEnabled ? (
                        <a href="/community-reporter/my-stories" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => { try { window.localStorage.setItem('np_communityReporterEmail', signUpData.email.trim()); } catch {} }}>View My Community Stories</a>
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-300">Status tracking for community stories is temporarily offline. Our editorial team will still review your story.</span>
                      )}
                    </div>
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

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = async () => {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  let communityReporterClosed = false;
  let reporterPortalClosed = false;
  try {
    const resp = await fetch(`${base}/api/public/feature-toggles`, { headers: { Accept: 'application/json' } });
    const data = await resp.json().catch(() => null as any);
    if (resp.ok && data) {
      communityReporterClosed = Boolean(data.communityReporterClosed);
      reporterPortalClosed = Boolean(data.reporterPortalClosed);
    }
  } catch {}
  return { props: { communityReporterClosed, reporterPortalClosed } };
};
