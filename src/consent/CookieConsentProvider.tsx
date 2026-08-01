import Link from 'next/link';
import Script from 'next/script';
import React from 'react';
import { Cookie, LockKeyhole, Settings, ShieldCheck, X } from 'lucide-react';

import { useI18n } from '../i18n/LanguageProvider';
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
  const previousOverflow = document.body.style.overflow;
  const previousScrollX = typeof window !== 'undefined' ? window.scrollX : 0;
  const previousScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  if (isLocked) document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = previousOverflow;
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
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/62 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      data-testid="cookie-preferences-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closePreferences(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-slate-950 shadow-[0_30px_90px_-38px_rgba(2,6,23,0.8)] outline-none sm:max-h-[calc(100dvh-2rem)]"
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
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch] sm:px-6"
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
            <CategoryRow
              key={key}
              title={t(`cookieConsent.categories.${key}.title`)}
              description={t(`cookieConsent.categories.${key}.description`)}
              checked={draft[key]}
              onChange={(value) => setOptional(key, value)}
            />
          ))}
        </div>

        <div className="grid flex-shrink-0 gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3 sm:px-6" data-testid="cookie-preferences-footer">
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
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const thumbTransform = checked ? 'translateX(24px)' : 'translateX(0)';

  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className="inline-flex shrink-0 items-center rounded-full border border-transparent p-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
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