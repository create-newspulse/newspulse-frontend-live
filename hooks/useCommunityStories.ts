import { useContext, createContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { CommunitySettingsPublic, CommunityStorySummary, CommunitySubmissionCounts } from '../types/community-reporter';
import { fetchMyStoriesByEmail, fetchPublicSettings, isCommunityReporterHttpError, withdrawStoryById } from '../lib/communityReporterApi';
import { getSubmissionCounts, normalizeReporterEmail } from '../lib/reporterPortal';
import { useI18n } from '../src/i18n/LanguageProvider';

export type ReporterProfileSummary = {
  fullName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
};

export type UseCommunityStoriesValue = {
  settings: CommunitySettingsPublic | null;
  settingsLoading: boolean;
  settingsError: string | null;
  reporterEmail: string | null;
  reporterProfile: ReporterProfileSummary | null;
  profileWarning: string | null;
  stories: CommunityStorySummary[];
  counts: CommunitySubmissionCounts;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  errorStatus: number | null;
  hasLoadedOnce: boolean;
  loadingId: string | null;
  loadStories: () => Promise<void>;
  withdraw: (story: CommunityStorySummary) => Promise<boolean>;
};

type UseCommunityStoriesOptions = {
  reporterEmail?: string | null;
  reporterAuth?: boolean;
  debugContexts?: string[];
};

const CommunityStoriesOverrideContext = createContext<UseCommunityStoriesValue | null>(null);
export const CommunityStoriesProvider = CommunityStoriesOverrideContext.Provider;

export function useCommunityStories(opts?: UseCommunityStoriesOptions): UseCommunityStoriesValue {
  const override = useContext(CommunityStoriesOverrideContext);
  if (override) return override;
  const router = useRouter();
  const { t } = useI18n();
  const hasExplicitReporterEmail = Object.prototype.hasOwnProperty.call(opts || {}, 'reporterEmail');

  const [settings, setSettings] = useState<CommunitySettingsPublic | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [reporterEmail, setReporterEmail] = useState<string | null>(null);
  const [reporterProfile, setReporterProfile] = useState<ReporterProfileSummary | null>(null);
  const [profileWarning, setProfileWarning] = useState<string | null>(null);
  const [stories, setStories] = useState<CommunityStorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsError(null);
    fetchPublicSettings()
      .then((s) => {
        if (cancelled) return;
        if (s) setSettings(s);
        else setSettingsError('SETTINGS_FETCH_FAILED');
      })
      .catch(() => {
        if (!cancelled) setSettingsError('SETTINGS_FETCH_EXCEPTION');
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve reporter email from query/localStorage/profile
  useEffect(() => {
    const preferredEmail = normalizeReporterEmail(opts?.reporterEmail);
    if (hasExplicitReporterEmail) {
      setReporterEmail(preferredEmail || null);
      setStories([]);
      setError(null);
      setErrorCode(null);
      setErrorStatus(null);
      setProfileWarning(null);
      setHasLoadedOnce(false);
      return;
    }
    if (router.isReady) {
      const qEmail = typeof router.query.email === 'string' ? router.query.email.trim() : '';
      if (qEmail) {
        setReporterEmail(normalizeReporterEmail(qEmail));
        return;
      }
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('np_cr_email');
      if (stored && stored.trim()) {
        setReporterEmail(normalizeReporterEmail(stored));
        return;
      }
      const profileRaw = window.localStorage.getItem('npCommunityReporterProfile');
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p && p.email) setReporterEmail(normalizeReporterEmail(p.email));
        } catch {}
      }
    } catch {}
  }, [hasExplicitReporterEmail, opts?.reporterEmail, router.isReady, router.query.email]);

  // Resolve reporter profile/contact details from localStorage (safe fallback)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawV1 = window.localStorage.getItem('np_cr_profile_v1');
      const rawLegacy = window.localStorage.getItem('npCommunityReporterProfile');
      const raw = rawV1 || rawLegacy;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setReporterProfile({
        fullName: typeof parsed.fullName === 'string' ? parsed.fullName : (typeof parsed.name === 'string' ? parsed.name : undefined),
        email: typeof parsed.email === 'string' ? parsed.email : undefined,
        phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
        whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : (typeof parsed.reporterWhatsApp === 'string' ? parsed.reporterWhatsApp : undefined),
        city: typeof parsed.city === 'string' ? parsed.city : undefined,
        district: typeof parsed.district === 'string' ? parsed.district : undefined,
        state: typeof parsed.state === 'string' ? parsed.state : undefined,
        country: typeof parsed.country === 'string' ? parsed.country : undefined,
      });
    } catch {}
  }, []);

  const counts = useMemo(() => getSubmissionCounts(stories), [stories]);

  const loadStories = async () => {
    const em = normalizeReporterEmail(reporterEmail);
    setIsLoading(true);
    setHasLoadedOnce(false);
    setError(null);
    setErrorCode(null);
    setErrorStatus(null);
    setProfileWarning(null);
    try {
      const hasEmail = em && em.includes('@');
      if (!hasEmail) {
        setError(t('communityReporter.errors.missingEmail'));
        setErrorCode('MISSING_EMAIL');
        setErrorStatus(400);
        setStories([]);
        setHasLoadedOnce(true);
        return;
      }
      const items = await fetchMyStoriesByEmail(em, {
        reporterAuth: Boolean(opts?.reporterAuth),
        useProxy: Boolean(opts?.reporterAuth),
        debugContexts: opts?.debugContexts,
      });
      setStories(items);
      setHasLoadedOnce(true);
      try {
        if (em) window.localStorage.setItem('np_cr_email', em.toLowerCase());
      } catch {}
    } catch (err: any) {
      if (isCommunityReporterHttpError(err)) {
        setErrorCode(String(err.code || err.message || 'STORIES_FETCH_FAILED'));
        setErrorStatus(err.status);
        if (err.status >= 500) {
          setProfileWarning('REPORTER_PROFILE_UNAVAILABLE');
        }
      } else {
        setErrorCode('STORIES_FETCH_FAILED');
        setErrorStatus(null);
      }

      setError(t('communityReporter.errors.loadStoriesFailed'));
      setStories([]);
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  };

  const withdraw = async (story: CommunityStorySummary): Promise<boolean> => {
    try {
      const sid = String(story.id || story.referenceId || '').trim();
      if (!sid) return false;
      setLoadingId(sid);
      const reporterId = (typeof window !== 'undefined') ? window.localStorage.getItem('np_communityReporterId') : null;
      const ok = await withdrawStoryById(sid, reporterId);
      if (ok) await loadStories();
      return ok;
    } catch {
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  // Auto-load on reporterEmail change
  useEffect(() => {
    if (reporterEmail) loadStories();
    else {
      setStories([]);
      setError(null);
      setErrorCode(null);
      setErrorStatus(null);
      setProfileWarning(null);
      setHasLoadedOnce(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.reporterAuth, reporterEmail]);

  return {
    settings,
    settingsLoading,
    settingsError,
    reporterEmail,
    reporterProfile,
    profileWarning,
    stories,
    counts,
    isLoading,
    error,
    errorCode,
    errorStatus,
    hasLoadedOnce,
    loadingId,
    loadStories,
    withdraw,
  };
}
