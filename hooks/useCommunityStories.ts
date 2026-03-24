import { useContext, createContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { CommunitySettingsPublic, CommunityStorySummary } from '../types/community-reporter';
import { fetchMyStoriesByEmail, fetchPublicSettings, isCommunityReporterHttpError, withdrawStoryById } from '../lib/communityReporterApi';
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
  counts: { total: number; pending: number; approved: number; rejected: number; withdrawn: number };
  isLoading: boolean;
  error: string | null;
  hasLoadedOnce: boolean;
  loadingId: string | null;
  loadStories: () => Promise<void>;
  withdraw: (story: CommunityStorySummary) => Promise<boolean>;
};

const CommunityStoriesOverrideContext = createContext<UseCommunityStoriesValue | null>(null);
export const CommunityStoriesProvider = CommunityStoriesOverrideContext.Provider;

export function useCommunityStories(): UseCommunityStoriesValue {
  const override = useContext(CommunityStoriesOverrideContext);
  if (override) return override;
  const router = useRouter();
  const { t } = useI18n();

  const [settings, setSettings] = useState<CommunitySettingsPublic | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [reporterEmail, setReporterEmail] = useState<string | null>(null);
  const [reporterProfile, setReporterProfile] = useState<ReporterProfileSummary | null>(null);
  const [profileWarning, setProfileWarning] = useState<string | null>(null);
  const [stories, setStories] = useState<CommunityStorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (router.isReady) {
      const qEmail = typeof router.query.email === 'string' ? router.query.email.trim() : '';
      if (qEmail) {
        setReporterEmail(qEmail);
        return;
      }
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('np_cr_email');
      if (stored && stored.trim()) {
        setReporterEmail(stored.trim());
        return;
      }
      const profileRaw = window.localStorage.getItem('npCommunityReporterProfile');
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p && p.email) setReporterEmail(String(p.email).trim());
        } catch {}
      }
    } catch {}
  }, [router.isReady, router.query.email]);

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

  const counts = useMemo(() => {
    const total = stories.length;
    const pending = stories.filter(s => ['pending', 'under_review'].includes((s.status || '').toLowerCase())).length;
    const approved = stories.filter(s => ['approved', 'published'].includes((s.status || '').toLowerCase())).length;
    const rejected = stories.filter(s => (s.status || '').toLowerCase() === 'rejected').length;
    const withdrawn = stories.filter(s => (s.status || '').toLowerCase() === 'withdrawn').length;
    return { total, pending, approved, rejected, withdrawn };
  }, [stories]);

  const loadStories = async () => {
    const em = (reporterEmail || '').trim();
    setIsLoading(true);
    setError(null);
    setProfileWarning(null);
    try {
      const hasEmail = em && em.includes('@');
      if (!hasEmail) {
        setError(t('communityReporter.errors.missingEmail'));
        setStories([]);
        setHasLoadedOnce(true);
        return;
      }
      const items = await fetchMyStoriesByEmail(em);
      setStories(items);
      setHasLoadedOnce(true);
      try {
        if (em) window.localStorage.setItem('np_cr_email', em.toLowerCase());
      } catch {}
    } catch (err: any) {
      // Backend may 500 due to reporter profile/contact issues. Don't blank out the UI.
      if (isCommunityReporterHttpError(err) && err.status >= 500) {
        setProfileWarning('REPORTER_PROFILE_UNAVAILABLE');
        setHasLoadedOnce(true);
        // Keep any previously-loaded stories in state.
        return;
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
    else setHasLoadedOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporterEmail]);

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
    hasLoadedOnce,
    loadingId,
    loadStories,
    withdraw,
  };
}
