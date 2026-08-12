import Link from 'next/link';
import Script from 'next/script';
import React from 'react';
import { Bell, Cookie, LockKeyhole, Settings, ShieldCheck, X } from 'lucide-react';

import { useI18n } from '../i18n/LanguageProvider';
import { getFirebaseClientConfig } from '../../lib/firebaseClient';
import {
  FIREBASE_MESSAGING_SERVICE_WORKER_PATH,
  getCurrentNotificationPermission,
  isFirebaseMessagingSupported,
  registerBrowserForFcm,
  type FcmRegistrationResult,
} from '../../lib/firebaseMessaging';
import {
  defaultPushNotificationPreferences,
  hasStoredPushNotificationPreferences,
  readPushNotificationPreferences,
  supportedNewsPulsePushCategories,
  writePushNotificationPreferences,
  type PushNotificationPreferences,
  type PushNotificationTypeKey,
} from '../../lib/pushNotificationPreferences';
import {
  checkNewsPulsePushBackendDiagnostics,
  readStoredPushRegistration,
  registerNewsPulsePushSubscription,
  unregisterNewsPulsePushSubscription,
  updateNewsPulsePushPreferences,
  type PushRegistrationIdentifier,
} from '../../lib/pushSubscriptionClient';
import {
  allAcceptedCategories,
  clearStorageKeys,
  createConsentRecord,
  defaultDeniedCategories,
  deleteCookie,
  deleteConsentCookie,
  getGoogleConsentState,
  hasConsentForCategory,
  optionalCategoryKeys,
  readStoredConsent,
  type CookieConsentCategories,
  type CookieConsentRecord,
  type OptionalCookieConsentCategory,
  writeConsentCookie,
} from './cookieConsent';

type CookieConsentContextType = {
  consent: CookieConsentRecord | null;
  categories: CookieConsentCategories;
  hasDecision: boolean;
  isPreferencesOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (categories: Partial<Record<OptionalCookieConsentCategory, boolean>>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  resetConsent: () => void;
  hasCategoryConsent: (category: keyof CookieConsentCategories) => boolean;
};

const CookieConsentContext = React.createContext<CookieConsentContextType | undefined>(undefined);

function updateGoogleConsent(categories: CookieConsentCategories) {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;
  gtag('consent', 'update', getGoogleConsentState(categories));
}

function cleanupOptionalTechnologies(categories: CookieConsentCategories) {
  if (!categories.preferences) {
    clearStorageKeys(['np_locale', 'theme', 'np_style', 'news-pulse-bookmarks']);
    deleteCookie('np_locale');
    deleteCookie('np_lang');
    deleteCookie('NEXT_LOCALE');
  }

  if (!categories.analytics) {
    clearStorageKeys(['np_visitor_id_v1', 'np_session_id_v1', 'np_session_last_activity_v1']);
    deleteCookie('np_vid');
  }

  if (!categories.embeddedMedia && typeof document !== 'undefined') {
    document.getElementById('news-pulse-x-widgets')?.remove();
  }
}

function applyBodyScrollLock(isLocked: boolean) {
  if (typeof document === 'undefined') return undefined;
  const root = document.documentElement;
  const previousRootOverflow = root.style.overflow;
  const previousOverflow = document.body.style.overflow;
  const previousOverscrollBehavior = document.body.style.overscrollBehavior;
  const previousScrollX = typeof window !== 'undefined' ? window.scrollX : 0;
  const previousScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  if (isLocked) {
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
  }
  return () => {
    root.style.overflow = previousRootOverflow;
    document.body.style.overflow = previousOverflow;
    document.body.style.overscrollBehavior = previousOverscrollBehavior;
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(previousScrollX, previousScrollY);
    } catch {
      // ignore
    }
  };
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = React.useState<CookieConsentRecord | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);
  const lastFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const stored = readStoredConsent();
    setConsent(stored);
    setHasLoaded(true);
    updateGoogleConsent(stored?.categories ?? defaultDeniedCategories);
  }, []);

  const persistConsent = React.useCallback((record: CookieConsentRecord) => {
    writeConsentCookie(record);
    cleanupOptionalTechnologies(record.categories);
    setConsent(record);
    updateGoogleConsent(record.categories);
    setIsPreferencesOpen(false);
  }, []);

  const acceptAll = React.useCallback(() => {
    persistConsent(createConsentRecord('accepted', allAcceptedCategories));
  }, [persistConsent]);

  const rejectNonEssential = React.useCallback(() => {
    persistConsent(createConsentRecord('rejected', defaultDeniedCategories));
  }, [persistConsent]);

  const savePreferences = React.useCallback((categories: Partial<Record<OptionalCookieConsentCategory, boolean>>) => {
    persistConsent(createConsentRecord('custom', categories));
  }, [persistConsent]);

  const openPreferences = React.useCallback(() => {
    if (typeof document !== 'undefined') lastFocusRef.current = document.activeElement as HTMLElement | null;
    setIsPreferencesOpen(true);
  }, []);

  const closePreferences = React.useCallback(() => {
    setIsPreferencesOpen(false);
    window.setTimeout(() => lastFocusRef.current?.focus?.(), 0);
  }, []);

  const resetConsent = React.useCallback(() => {
    deleteConsentCookie();
    cleanupOptionalTechnologies(defaultDeniedCategories);
    setConsent(null);
    updateGoogleConsent(defaultDeniedCategories);
    setIsPreferencesOpen(false);
  }, []);

  const categories = consent?.categories ?? defaultDeniedCategories;
  const hasDecision = Boolean(consent);
  const shouldShowBanner = hasLoaded && !hasDecision && !isPreferencesOpen;

  const value = React.useMemo<CookieConsentContextType>(() => ({
    consent,
    categories,
    hasDecision,
    isPreferencesOpen,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    openPreferences,
    closePreferences,
    resetConsent,
    hasCategoryConsent: (category) => hasConsentForCategory(consent, category),
  }), [acceptAll, categories, closePreferences, consent, hasDecision, isPreferencesOpen, openPreferences, rejectNonEssential, resetConsent, savePreferences]);

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      <GoogleConsentScripts categories={categories} />
      {shouldShowBanner ? <CookieConsentBanner /> : null}
      {isPreferencesOpen ? <CookiePreferencesModal /> : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = React.useContext(CookieConsentContext);
  if (!context) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return context;
}

export function useOptionalCookieConsent() {
  return React.useContext(CookieConsentContext) ?? null;
}

function GoogleConsentScripts({ categories }: { categories: CookieConsentCategories }) {
  const gaId = String(process.env.NEXT_PUBLIC_GA_ID || '').trim();
  const adsensePublisherId = String(process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || '').trim();
  const googleConsent = getGoogleConsentState(categories);
  const canLoadAnalytics = Boolean(gaId && categories.analytics);
  const canLoadAdvertising = Boolean(adsensePublisherId && categories.advertising);

  return (
    <>
      {gaId || adsensePublisherId ? (
        <Script
          id="np-google-consent-default"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
              window.gtag('consent', 'default', ${JSON.stringify(getGoogleConsentState(defaultDeniedCategories))});
            `,
          }}
        />
      ) : null}

      {canLoadAnalytics ? (
        <>
          <Script id="np-gtag-src" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
          <Script
            id="np-gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
                window.gtag('consent', 'update', ${JSON.stringify(googleConsent)});
                if (!window.__npGtagInitialized) {
                  window.__npGtagInitialized = true;
                  window.gtag('js', new Date());
                  window.gtag('config', '${gaId}', { page_path: window.location.pathname });
                }
              `,
            }}
          />
        </>
      ) : null}

      {canLoadAdvertising ? (
        <>
          <Script id="np-google-funding-choices" src={`https://fundingchoicesmessages.google.com/i/${encodeURIComponent(adsensePublisherId)}?ers=1`} strategy="afterInteractive" />
          <Script
            id="np-googlefc-present"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  function signalGooglefcPresent() { if (!window.frames['googlefcPresent']) {
                    if (document.body) {
                      var iframe = document.createElement('iframe'); iframe.style='width:0;height:0;border:0;display:none';
                      iframe.name='googlefcPresent'; document.body.appendChild(iframe);
                    } else { setTimeout(signalGooglefcPresent, 50); }
                  } }
                  signalGooglefcPresent();
                })();
              `,
            }}
          />
        </>
      ) : null}
    </>
  );
}

function CookieConsentBanner() {
  const { t } = useI18n();
  const { acceptAll, rejectNonEssential, openPreferences } = useCookieConsent();

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5 sm:pb-5"
      aria-label={t('cookieConsent.banner.title')}
    >
      <div className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.5)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Cookie className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-black tracking-tight text-slate-950">{t('cookieConsent.banner.title')}</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{t('cookieConsent.banner.text')}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/cookie-policy" className="text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
              {t('cookieConsent.links.cookiePolicy')}
            </Link>
            <Link href="/privacy-policy" className="text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
              {t('cookieConsent.links.privacyPolicy')}
            </Link>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
          <button type="button" onClick={acceptAll} className="rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.acceptAll')}
          </button>
          <button type="button" onClick={rejectNonEssential} className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.rejectNonEssential')}
          </button>
          <button type="button" onClick={openPreferences} className="rounded-full border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-900 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.managePreferences')}
          </button>
        </div>
      </div>
    </section>
  );
}

function CookiePreferencesModal() {
  const { t } = useI18n();
  const { categories, acceptAll, rejectNonEssential, savePreferences, closePreferences } = useCookieConsent();
  const dialogRef = React.useRef<HTMLElement | null>(null);
  const [draft, setDraft] = React.useState(() => categories);

  React.useEffect(() => setDraft(categories), [categories]);

  React.useEffect(() => {
    const cleanup = applyBodyScrollLock(true);
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable?.[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreferences();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute('disabled'));
      if (!nodes.length) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cleanup?.();
    };
  }, [closePreferences]);

  const setOptional = (key: OptionalCookieConsentCategory, value: boolean) => {
    setDraft((current) => ({ ...current, necessary: true, [key]: value }));
  };

  const save = () => {
    savePreferences({
      preferences: draft.preferences,
      analytics: draft.analytics,
      advertising: draft.advertising,
      embeddedMedia: draft.embeddedMedia,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-hidden overscroll-none bg-slate-950/62 p-2 backdrop-blur-sm sm:p-4"
      data-testid="cookie-preferences-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closePreferences(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-slate-950 shadow-[0_30px_90px_-38px_rgba(2,6,23,0.8)] outline-none"
        style={{ height: 'min(90vh, calc(100dvh - 1rem))', maxHeight: 'min(90vh, calc(100dvh - 1rem))' }}
        data-testid="cookie-preferences-dialog"
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t('cookieConsent.modal.eyebrow')}
            </div>
            <h2 id="cookie-preferences-title" className="mt-2 text-2xl font-black tracking-tight">{t('cookieConsent.modal.title')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('cookieConsent.modal.text')}</p>
          </div>
          <button type="button" onClick={closePreferences} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2" aria-label={t('cookieConsent.actions.close')}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch] sm:px-6"
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          data-testid="cookie-preferences-scroll-area"
          tabIndex={0}
        >
          <CategoryRow
            title={t('cookieConsent.categories.necessary.title')}
            description={t('cookieConsent.categories.necessary.description')}
            checked
            locked
          />
          {optionalCategoryKeys.map((key) => (
            <React.Fragment key={key}>
              <CategoryRow
                title={t(`cookieConsent.categories.${key}.title`)}
                description={t(`cookieConsent.categories.${key}.description`)}
                checked={draft[key]}
                onChange={(value) => setOptional(key, value)}
              />
              {key === 'preferences' ? <PushNotificationRow /> : null}
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6" data-testid="cookie-preferences-footer">
          <button type="button" onClick={rejectNonEssential} className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.rejectNonEssential')}
          </button>
          <button type="button" onClick={save} className="rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.savePreferences')}
          </button>
          <button type="button" onClick={acceptAll} className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
            {t('cookieConsent.actions.acceptAll')}
          </button>
        </div>
      </section>
    </div>
  );
}

function CookieSwitch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const thumbTransform = checked ? 'translateX(24px)' : 'translateX(0)';

  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
      className="inline-flex shrink-0 items-center rounded-full border border-transparent p-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      data-testid={`cookie-switch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      style={{
        width: 56,
        minWidth: 56,
        height: 32,
        backgroundColor: checked ? '#0f172a' : '#cbd5e1',
      }}
    >
      <span
        className="block shrink-0 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] transition-transform duration-200 ease-out"
        data-testid={`cookie-switch-thumb-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        style={{ width: 24, height: 24, transform: thumbTransform }}
      />
    </button>
  );
}

type PushNotificationStatus = 'checking' | 'unavailable' | 'default' | 'granted' | 'denied' | 'registering';

type PushDiagnosticStatus = 'Granted' | 'Blocked' | 'Not asked' | 'Unavailable' | 'Active' | 'Not active' | 'Registered' | 'Failed' | 'Not attempted' | 'Synced' | 'Yes' | 'No' | 'Configured' | 'Not Configured';

type PushDiagnostics = {
  browserPermission: PushDiagnosticStatus;
  serviceWorker: PushDiagnosticStatus;
  firebaseRegistration: PushDiagnosticStatus;
  serverSync: PushDiagnosticStatus;
  preferencesSync: PushDiagnosticStatus;
  backendReachable: PushDiagnosticStatus;
  firebaseBackend: PushDiagnosticStatus;
  messagingAvailable: PushDiagnosticStatus;
  lastUpdated: string;
};

const PUSH_BLOCKED_MESSAGE = "Notifications are blocked in your browser. Allow notifications in your browser's site settings to receive News Pulse alerts.";
const PUSH_ENABLED_MESSAGE = 'Notifications enabled and synced';
const PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE = 'News Pulse alerts are temporarily unavailable on this browser.';
const PUSH_BACKEND_SYNC_FAILED_MESSAGE = PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE;

const pushNotificationTypeLabels: Array<{ key: PushNotificationTypeKey; label: string }> = [
  { key: 'breakingNews', label: 'Breaking News' },
  { key: 'topStories', label: 'Top Stories' },
  { key: 'newArticleAlerts', label: 'New Article Alerts' },
  { key: 'categoryAlerts', label: 'Category Alerts' },
  { key: 'allArticles', label: 'All Articles' },
];

function getPushStatusLabel(status: PushNotificationStatus): string {
  if (status === 'granted') return 'Enabled';
  if (status === 'denied') return 'Notifications are blocked in your browser settings';
  if (status === 'unavailable') return 'Notifications are temporarily unavailable';
  if (status === 'registering') return 'Enabling...';
  if (status === 'checking') return 'Checking...';
  return 'Notifications are off';
}

function getPushStatusDescription(status: PushNotificationStatus, detail: string): string {
  if (status === 'denied') return PUSH_BLOCKED_MESSAGE;
  if (detail) return detail;
  if (status === 'unavailable') return PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE;
  if (status === 'default') return 'Turn this on to receive News Pulse news alerts on this device.';
  if (status === 'granted') return PUSH_ENABLED_MESSAGE;
  return '';
}

function isPushEnabled(status: PushNotificationStatus): boolean {
  return status === 'granted' || status === 'registering';
}

function markPushPreferencesEnabled(preferences: PushNotificationPreferences): PushNotificationPreferences {
  return writePushNotificationPreferences({ ...preferences, enabled: true });
}

function getStatusFromRegistrationResult(result: FcmRegistrationResult): PushNotificationStatus {
  if (result.ok) return 'granted';
  if (result.reason === 'permission-blocked') return 'denied';
  if (result.reason === 'permission-dismissed') return 'default';
  return 'unavailable';
}

function getBrowserPermissionDiagnostic(permission: ReturnType<typeof getCurrentNotificationPermission>): PushDiagnosticStatus {
  if (permission === 'granted') return 'Granted';
  if (permission === 'denied') return 'Blocked';
  if (permission === 'default') return 'Not asked';
  return 'Unavailable';
}

function getImmediateServiceWorkerDiagnostic(): PushDiagnosticStatus {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'Unavailable';
  return navigator.serviceWorker.controller ? 'Active' : 'Not active';
}

function createPushDiagnosticsSnapshot(overrides: Partial<PushDiagnostics> = {}): PushDiagnostics {
  return {
    browserPermission: 'Not attempted',
    serviceWorker: getImmediateServiceWorkerDiagnostic(),
    firebaseRegistration: 'Not attempted',
    serverSync: 'Not attempted',
    preferencesSync: 'Not attempted',
    backendReachable: 'Not attempted',
    firebaseBackend: 'Not attempted',
    messagingAvailable: 'Not attempted',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

async function getServiceWorkerDiagnostic(): Promise<PushDiagnosticStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'Unavailable';
  try {
    const registrations = typeof navigator.serviceWorker.getRegistrations === 'function'
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    if (navigator.serviceWorker.controller || registrations.some((registration) => {
      const workerUrls = [registration.active?.scriptURL, registration.waiting?.scriptURL, registration.installing?.scriptURL].filter(Boolean);
      return workerUrls.some((url) => String(url).endsWith(FIREBASE_MESSAGING_SERVICE_WORKER_PATH));
    })) {
      return 'Active';
    }
    return 'Not active';
  } catch {
    return 'Unavailable';
  }
}

function PushDiagnosticsRows({ diagnostics, onRefresh }: { diagnostics: PushDiagnostics; onRefresh: () => void }) {
  const rows: Array<{ label: string; value: PushDiagnosticStatus }> = [
    { label: 'Browser permission', value: diagnostics.browserPermission },
    { label: 'Service worker', value: diagnostics.serviceWorker },
    { label: 'Firebase registration', value: diagnostics.firebaseRegistration },
    { label: 'News Pulse server sync', value: diagnostics.serverSync },
    { label: 'Preferences sync', value: diagnostics.preferencesSync },
    { label: 'Backend reachable', value: diagnostics.backendReachable },
    { label: 'Firebase backend', value: diagnostics.firebaseBackend },
    { label: 'Messaging available', value: diagnostics.messagingAvailable },
    { label: 'Last updated', value: diagnostics.lastUpdated as PushDiagnosticStatus },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="push-diagnostics">
      <div className="grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
            <span className="font-semibold text-slate-500">{row.label}</span>
            <span className="truncate text-right font-black text-slate-800">{row.value}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onRefresh} className="mt-3 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
        Check Push Status
      </button>
    </div>
  );
}

function isFcmTestControlEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL === 'true';
}

function PushNotificationRow() {
  const { lang } = useI18n();
  const [status, setStatus] = React.useState<PushNotificationStatus>('checking');
  const [detail, setDetail] = React.useState('');
  const [preferences, setPreferences] = React.useState<PushNotificationPreferences>(defaultPushNotificationPreferences);
  const [diagnostics, setDiagnostics] = React.useState<PushDiagnostics>(() => createPushDiagnosticsSnapshot());
  const registrationRef = React.useRef<PushRegistrationIdentifier | null>(null);
  const statusRef = React.useRef<PushNotificationStatus>('checking');

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refreshDiagnostics = React.useCallback(async (includeBackend = false, overrides: Partial<PushDiagnostics> = {}) => {
    const [serviceWorker, backend] = await Promise.all([
      getServiceWorkerDiagnostic(),
      includeBackend ? checkNewsPulsePushBackendDiagnostics() : Promise.resolve(null),
    ]);
    setDiagnostics((current) => createPushDiagnosticsSnapshot({
      ...current,
      serviceWorker,
      ...(backend
        ? {
            backendReachable: backend.backendReachable ? 'Yes' : 'No',
            firebaseBackend: backend.firebaseBackendConfigured ? 'Configured' : 'Not Configured',
            messagingAvailable: backend.messagingAvailable ? 'Yes' : 'No',
          }
        : {}),
      ...overrides,
    }));
  }, []);

  const registerGrantedBrowser = React.useCallback(async (currentPreferences: PushNotificationPreferences) => {
    setStatus('registering');
    setDetail('');
    setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, firebaseRegistration: 'Not attempted', serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
    const result = await registerBrowserForFcm();
    const nextStatus = getStatusFromRegistrationResult(result);
    setStatus(nextStatus);
    setDetail(result.ok ? result.backendSync.message : result.reason === 'registration-failed' ? PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE : result.message);
    setDiagnostics((current) => createPushDiagnosticsSnapshot({
      ...current,
      browserPermission: result.permission === 'granted' ? 'Granted' : current.browserPermission,
      serviceWorker: result.ok ? 'Active' : current.serviceWorker,
      firebaseRegistration: result.ok ? 'Registered' : 'Failed',
      serverSync: 'Not attempted',
      preferencesSync: 'Not attempted',
    }));

    if (result.ok) {
      const enabledPreferences = markPushPreferencesEnabled(currentPreferences);
      setPreferences(enabledPreferences);
      const backendResult = await registerNewsPulsePushSubscription({
        registrationId: result.registrationId,
        permission: result.permission,
        language: lang,
        preferences: enabledPreferences,
      });
      if (backendResult.ok) {
        registrationRef.current = {
          registrationId: backendResult.registrationId,
          registrationType: backendResult.registrationType,
        };
        setDetail(PUSH_ENABLED_MESSAGE);
        setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, serverSync: 'Synced', preferencesSync: 'Synced' }));
      } else {
        setDetail(PUSH_BACKEND_SYNC_FAILED_MESSAGE);
        setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, serverSync: 'Failed', preferencesSync: 'Not attempted' }));
      }
    }
  }, [lang]);

  React.useEffect(() => {
    let cancelled = false;

    async function inspectPushAvailability() {
      const storedPreferences = readPushNotificationPreferences();
      const hasStoredPreferences = hasStoredPushNotificationPreferences();
      const storedRegistration = readStoredPushRegistration();
      if (!cancelled) {
        setPreferences(storedPreferences);
        registrationRef.current = storedRegistration || registrationRef.current;
      }

      const permission = getCurrentNotificationPermission();
      if (permission === 'denied') {
        if (!cancelled) {
          registrationRef.current = null;
          setStatus('denied');
          setDetail('');
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, browserPermission: 'Blocked', firebaseRegistration: 'Not attempted', serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
        }
        return;
      }

      if (permission === 'default') {
        if (!cancelled) {
          setStatus('default');
          setDetail('');
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, browserPermission: 'Not asked', firebaseRegistration: 'Not attempted', serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
        }
        return;
      }

      if (permission === 'unsupported') {
        if (!cancelled) {
          setStatus('unavailable');
          setDetail(PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE);
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, browserPermission: 'Unavailable', serviceWorker: 'Unavailable', firebaseRegistration: 'Failed' }));
        }
        return;
      }

      const configStatus = getFirebaseClientConfig();
      if (!configStatus.isConfigured) {
        if (!cancelled) {
          setStatus('unavailable');
          setDetail(PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE);
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, firebaseRegistration: 'Failed' }));
        }
        return;
      }

      const supported = await isFirebaseMessagingSupported();
      if (cancelled) return;
      if (!supported) {
        setStatus('unavailable');
        setDetail(PUSH_TEMPORARILY_UNAVAILABLE_MESSAGE);
        setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, firebaseRegistration: 'Failed' }));
        return;
      }

      if (permission === 'granted') {
        if (hasStoredPreferences && !storedPreferences.enabled) {
          setStatus('default');
          setDetail('Notifications are off for this device.');
          return;
        }
        if (storedRegistration) {
          setStatus('granted');
          setDetail(PUSH_ENABLED_MESSAGE);
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, browserPermission: 'Granted', firebaseRegistration: 'Registered', serverSync: 'Synced', preferencesSync: 'Synced' }));
          return;
        }
        if (statusRef.current === 'granted' && registrationRef.current) {
          setStatus('granted');
          return;
        }
        await registerGrantedBrowser(storedPreferences);
        return;
      }
    }

    inspectPushAvailability();
    const onFocus = () => {
      inspectPushAvailability();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshDiagnostics, registerGrantedBrowser]);

  const updateTypePreference = (key: PushNotificationTypeKey, checked: boolean) => {
    setPreferences((current) => {
      const next = writePushNotificationPreferences({
        ...current,
        enabled: true,
        types: { ...current.types, [key]: checked },
      });
      const registration = registrationRef.current;
      if (registration) {
        updateNewsPulsePushPreferences({ ...registration, language: lang, preferences: next }).then((result) => {
          if (!result.ok) setDetail(result.message);
          setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, preferencesSync: result.ok ? 'Synced' : 'Failed' }));
        });
      }
      return next;
    });
  };

  const handleMasterChange = async (checked: boolean) => {
    if (status === 'denied' || status === 'unavailable' || status === 'registering') return;

    if (checked) {
      const permission = getCurrentNotificationPermission();
      if (permission === 'denied') {
        registrationRef.current = null;
        setStatus('denied');
        setDetail('');
        setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, browserPermission: 'Blocked', firebaseRegistration: 'Not attempted', serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
        return;
      }
      await registerGrantedBrowser(preferences);
      return;
    }

    const nextPreferences = writePushNotificationPreferences({ ...preferences, enabled: false });
    setPreferences(nextPreferences);
    setStatus('default');
    setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
    const registration = registrationRef.current || readStoredPushRegistration();
    if (!registration) {
      setDetail('Notifications are off for this device.');
      return;
    }
    const result = await unregisterNewsPulsePushSubscription({ ...registration, language: lang });
    if (result.ok) {
      registrationRef.current = null;
      setDetail('Notifications are off for this device.');
      setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, firebaseRegistration: 'Not attempted', serverSync: 'Not attempted', preferencesSync: 'Not attempted' }));
    } else {
      setDetail(result.message);
      setDiagnostics((current) => createPushDiagnosticsSnapshot({ ...current, serverSync: 'Failed' }));
    }
  };

  const checked = isPushEnabled(status);
  const disabled = status === 'checking' || status === 'registering' || status === 'unavailable' || status === 'denied';
  const description = getPushStatusDescription(status, detail);
  const showDiagnostics = isFcmTestControlEnabled();

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4" data-testid="push-notifications-card">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-black tracking-tight text-slate-950">
            <Bell className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Push Notifications
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Receive News Pulse news alerts and article updates on this device.</p>
          {description ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{description}</p> : null}
        </div>
        <div className="flex min-h-10 w-full max-w-full shrink-0 items-center justify-end gap-3 justify-self-end text-sm font-bold text-slate-700 sm:w-auto" data-testid="push-notifications-master-control">
          <span className="whitespace-nowrap text-slate-700">{getPushStatusLabel(status)}</span>
          <CookieSwitch label="Enable Notifications" checked={checked} disabled={disabled} onChange={handleMasterChange} />
        </div>
      </div>

      {showDiagnostics ? <PushDiagnosticsRows diagnostics={diagnostics} onRefresh={() => refreshDiagnostics(true)} /> : null}

      {status === 'granted' ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="push-notification-types">
          <div className="grid gap-3 sm:grid-cols-2">
            {pushNotificationTypeLabels.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">
                <span>{item.label}</span>
                <CookieSwitch label={item.label} checked={preferences.types[item.key]} onChange={(value) => updateTypePreference(item.key, value)} />
              </div>
            ))}
          </div>
          {preferences.types.categoryAlerts ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Category Alerts are ready for future News Pulse sections: {supportedNewsPulsePushCategories.map((category) => category.label).join(', ')}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LockedSwitchIndicator({ label }: { label: string }) {
  return (
    <span
      aria-label={`${label} always enabled`}
      className="inline-flex shrink-0 items-center rounded-full border border-slate-800 p-1"
      data-testid={`cookie-switch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      style={{ width: 56, minWidth: 56, height: 32, backgroundColor: '#0f172a' }}
    >
      <span
        className="block shrink-0 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)]"
        data-testid={`cookie-switch-thumb-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        style={{ width: 24, height: 24, transform: 'translateX(24px)' }}
      />
    </span>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  locked = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-base font-black tracking-tight text-slate-950">
          {locked ? <LockKeyhole className="h-4 w-4 text-slate-500" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />}
          {title}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="flex min-h-10 w-full max-w-full shrink-0 items-center justify-end gap-3 justify-self-end text-sm font-bold text-slate-700 sm:w-auto" data-testid={`cookie-control-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
        <span className={locked ? 'inline-flex items-center gap-1.5 whitespace-nowrap text-slate-500' : 'whitespace-nowrap text-slate-700'}>
          {locked ? <LockKeyhole className="h-4 w-4" aria-hidden="true" /> : null}
          {locked ? 'Always enabled' : checked ? 'Enabled' : 'Disabled'}
        </span>
        {locked ? (
          <LockedSwitchIndicator label={title} />
        ) : (
          <CookieSwitch
            label={title}
            checked={checked}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}