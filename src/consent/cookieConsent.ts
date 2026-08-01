export const COOKIE_CONSENT_VERSION = '1.0';
export const COOKIE_CONSENT_NAME = 'np_cookie_consent';
export const COOKIE_CONSENT_MAX_AGE_DAYS = 180;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;

export type CookieConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'advertising' | 'embeddedMedia';

export type OptionalCookieConsentCategory = Exclude<CookieConsentCategory, 'necessary'>;

export type CookieConsentDecision = 'accepted' | 'rejected' | 'custom';

export type CookieConsentCategories = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  advertising: boolean;
  embeddedMedia: boolean;
};

export type CookieConsentRecord = {
  version: typeof COOKIE_CONSENT_VERSION;
  decision: CookieConsentDecision;
  categories: CookieConsentCategories;
  updatedAt: string;
  expiresAt: string;
};

export type CookieTechnologyInventoryItem = {
  name: string;
  provider: string;
  category: CookieConsentCategory;
  purpose: string;
  duration: string;
  currentStatus: 'Active' | 'Conditionally active' | 'Not currently active';
  storageType: 'Cookie' | 'localStorage' | 'sessionStorage' | 'Script' | 'Network request' | 'iframe';
  sourceFile: string;
};

export const defaultDeniedCategories: CookieConsentCategories = {
  necessary: true,
  preferences: false,
  analytics: false,
  advertising: false,
  embeddedMedia: false,
};

export const allAcceptedCategories: CookieConsentCategories = {
  necessary: true,
  preferences: true,
  analytics: true,
  advertising: true,
  embeddedMedia: true,
};

export const optionalCategoryKeys: OptionalCookieConsentCategory[] = ['preferences', 'analytics', 'advertising', 'embeddedMedia'];

export const cookieTechnologyInventory: CookieTechnologyInventoryItem[] = [
  {
    name: COOKIE_CONSENT_NAME,
    provider: 'News Pulse',
    category: 'necessary',
    purpose: 'Stores the user cookie-consent decision and category choices for this website.',
    duration: '180 days',
    currentStatus: 'Active',
    storageType: 'Cookie',
    sourceFile: 'src/consent/cookieConsent.ts',
  },
  {
    name: 'np_locale',
    provider: 'News Pulse',
    category: 'preferences',
    purpose: 'Remembers the selected News Pulse language for future visits when preference storage is allowed.',
    duration: 'Cookie: 1 year; localStorage: until cleared by the user',
    currentStatus: 'Conditionally active',
    storageType: 'Cookie',
    sourceFile: 'src/i18n/LanguageProvider.tsx',
  },
  {
    name: 'np_lang',
    provider: 'News Pulse',
    category: 'preferences',
    purpose: 'Legacy language preference cookie kept aligned with the current language when preference storage is allowed.',
    duration: '1 year',
    currentStatus: 'Conditionally active',
    storageType: 'Cookie',
    sourceFile: 'src/i18n/LanguageProvider.tsx',
  },
  {
    name: 'NEXT_LOCALE',
    provider: 'Next.js / News Pulse',
    category: 'preferences',
    purpose: 'Keeps route locale handling aligned with the selected language when preference storage is allowed.',
    duration: '1 year',
    currentStatus: 'Conditionally active',
    storageType: 'Cookie',
    sourceFile: 'src/i18n/LanguageProvider.tsx',
  },
  {
    name: 'theme',
    provider: 'News Pulse',
    category: 'preferences',
    purpose: 'Stores the selected display theme.',
    duration: 'localStorage: until cleared by the user',
    currentStatus: 'Conditionally active',
    storageType: 'localStorage',
    sourceFile: 'utils/ThemeContext.tsx',
  },
  {
    name: 'np_home_style_id_v1',
    provider: 'News Pulse',
    category: 'preferences',
    purpose: 'Stores the selected homepage style preset for the public homepage preview controls.',
    duration: 'localStorage/sessionStorage: until cleared by the user or the tab closes',
    currentStatus: 'Conditionally active',
    storageType: 'localStorage',
    sourceFile: 'pages/index.tsx',
  },
  {
    name: 'np_visitor_id_v1',
    provider: 'News Pulse',
    category: 'analytics',
    purpose: 'First-party article analytics visitor identifier used for aggregate article-performance measurement.',
    duration: 'localStorage: until cleared by the user',
    currentStatus: 'Conditionally active',
    storageType: 'localStorage',
    sourceFile: 'lib/analytics/articleAnalytics.ts',
  },
  {
    name: 'np_session_id_v1',
    provider: 'News Pulse',
    category: 'analytics',
    purpose: 'First-party article analytics session identifier used for aggregate reading and engagement measurement.',
    duration: 'sessionStorage: current browser tab session',
    currentStatus: 'Conditionally active',
    storageType: 'sessionStorage',
    sourceFile: 'lib/analytics/articleAnalytics.ts',
  },
  {
    name: 'np_session_last_activity_v1',
    provider: 'News Pulse',
    category: 'analytics',
    purpose: 'Tracks last article analytics activity time to determine whether a new first-party analytics session is needed.',
    duration: 'sessionStorage: current browser tab session',
    currentStatus: 'Conditionally active',
    storageType: 'sessionStorage',
    sourceFile: 'lib/analytics/articleAnalytics.ts',
  },
  {
    name: 'np_vid',
    provider: 'News Pulse',
    category: 'analytics',
    purpose: 'Fallback first-party visitor identifier for article analytics when localStorage is unavailable.',
    duration: 'Approximately 2 years',
    currentStatus: 'Conditionally active',
    storageType: 'Cookie',
    sourceFile: 'lib/analytics/articleAnalytics.ts',
  },
  {
    name: 'gtag.js / NEXT_PUBLIC_GA_ID',
    provider: 'Google Analytics',
    category: 'analytics',
    purpose: 'Loads Google Analytics only when a measurement ID exists and analytics consent has been granted.',
    duration: 'Google-controlled when enabled',
    currentStatus: 'Conditionally active',
    storageType: 'Script',
    sourceFile: 'pages/_app.tsx',
  },
  {
    name: 'fundingchoicesmessages.google.com / NEXT_PUBLIC_ADSENSE_PUB_ID',
    provider: 'Google Funding Choices',
    category: 'advertising',
    purpose: 'Loads Google advertising consent/support messaging only when a publisher ID exists and advertising consent has been granted.',
    duration: 'Google-controlled when enabled',
    currentStatus: 'Conditionally active',
    storageType: 'Script',
    sourceFile: 'pages/_app.tsx',
  },
  {
    name: 'Public ad slot requests',
    provider: 'News Pulse',
    category: 'advertising',
    purpose: 'Fetches and displays first-party public advertising placements when advertising consent is granted.',
    duration: 'Network request only unless an ad provider adds storage after consent',
    currentStatus: 'Conditionally active',
    storageType: 'Network request',
    sourceFile: 'src/components/ads/AdSlot.tsx',
  },
  {
    name: 'youtube-nocookie.com embeds',
    provider: 'YouTube / Google',
    category: 'embeddedMedia',
    purpose: 'Loads YouTube, YouTube Live, DroneTV and viral-video embeds after embedded-media consent.',
    duration: 'Provider-controlled once loaded',
    currentStatus: 'Conditionally active',
    storageType: 'iframe',
    sourceFile: 'src/lib/publicSettings.ts, lib/publicViralVideos.ts, pages/live-tv.tsx',
  },
  {
    name: 'platform.twitter.com/widgets.js',
    provider: 'X / Twitter',
    category: 'embeddedMedia',
    purpose: 'Loads X/Twitter status embeds for viral videos after embedded-media consent.',
    duration: 'Provider-controlled once loaded',
    currentStatus: 'Conditionally active',
    storageType: 'Script',
    sourceFile: 'pages/viral-videos/[slug].tsx',
  },
  {
    name: 'youth-story-draft',
    provider: 'News Pulse',
    category: 'necessary',
    purpose: 'Temporarily saves an in-progress Youth Pulse story draft so the form can recover during the same browser use.',
    duration: 'localStorage: removed when the story is submitted or cleared by the user',
    currentStatus: 'Active',
    storageType: 'localStorage',
    sourceFile: 'components/youth/SubmitStoryModal.tsx',
  },
  {
    name: 'news-pulse-bookmarks',
    provider: 'News Pulse',
    category: 'preferences',
    purpose: 'Stores locally saved article bookmarks on the device.',
    duration: 'localStorage: until cleared by the user',
    currentStatus: 'Conditionally active',
    storageType: 'localStorage',
    sourceFile: 'hooks/useBookmarks.ts',
  },
  {
    name: 'Reporter portal local profile keys',
    provider: 'News Pulse',
    category: 'necessary',
    purpose: 'Supports community reporter account continuity and authenticated reporter workflows.',
    duration: 'localStorage: until logout or cleared by the user; auth cookies are set by reporter-auth API responses',
    currentStatus: 'Active',
    storageType: 'localStorage',
    sourceFile: 'components/community-reporter/SubmissionExperience.tsx, lib/reporterPortal.ts',
  },
  {
    name: 'Microsoft Clarity',
    provider: 'Microsoft',
    category: 'analytics',
    purpose: 'No Microsoft Clarity implementation was found in the frontend codebase audit.',
    duration: 'Not applicable',
    currentStatus: 'Not currently active',
    storageType: 'Script',
    sourceFile: 'Audit: no matching source file',
  },
  {
    name: 'Hotjar',
    provider: 'Hotjar',
    category: 'analytics',
    purpose: 'No Hotjar implementation was found in the frontend codebase audit.',
    duration: 'Not applicable',
    currentStatus: 'Not currently active',
    storageType: 'Script',
    sourceFile: 'Audit: no matching source file',
  },
  {
    name: 'Facebook/Instagram pixels',
    provider: 'Meta',
    category: 'advertising',
    purpose: 'No Meta pixel implementation was found in the frontend codebase audit.',
    duration: 'Not applicable',
    currentStatus: 'Not currently active',
    storageType: 'Script',
    sourceFile: 'Audit: no matching source file',
  },
  {
    name: 'Chat widgets',
    provider: 'Not configured',
    category: 'preferences',
    purpose: 'No chat widget implementation was found in the frontend codebase audit.',
    duration: 'Not applicable',
    currentStatus: 'Not currently active',
    storageType: 'Script',
    sourceFile: 'Audit: no matching source file',
  },
  {
    name: 'Web push notification provider',
    provider: 'Not configured',
    category: 'preferences',
    purpose: 'No web notification provider implementation was found in the active Next.js frontend audit.',
    duration: 'Not applicable',
    currentStatus: 'Not currently active',
    storageType: 'Script',
    sourceFile: 'Audit: no matching active source file',
  },
];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeCategories(value: unknown): CookieConsentCategories {
  const raw = value && typeof value === 'object' ? value as Partial<Record<CookieConsentCategory, unknown>> : {};
  return {
    necessary: true,
    preferences: raw.preferences === true,
    analytics: raw.analytics === true,
    advertising: raw.advertising === true,
    embeddedMedia: raw.embeddedMedia === true,
  };
}

export function createConsentRecord(decision: CookieConsentDecision, categories: Partial<Record<OptionalCookieConsentCategory, boolean>>, nowDate = new Date()): CookieConsentRecord {
  return {
    version: COOKIE_CONSENT_VERSION,
    decision,
    categories: normalizeCategories({ necessary: true, ...categories }),
    updatedAt: nowDate.toISOString(),
    expiresAt: addDays(nowDate, COOKIE_CONSENT_MAX_AGE_DAYS).toISOString(),
  };
}

export function parseConsentRecord(rawValue: string | undefined | null, nowDate = new Date()): CookieConsentRecord | null {
  if (!rawValue) return null;

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.decision !== 'accepted' && parsed.decision !== 'rejected' && parsed.decision !== 'custom') return null;

    const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : '';
    const expiresDate = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(expiresDate.getTime()) || expiresDate.getTime() <= nowDate.getTime()) return null;

    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
    const updatedDate = new Date(updatedAt);
    if (!updatedAt || Number.isNaN(updatedDate.getTime())) return null;

    return {
      version: COOKIE_CONSENT_VERSION,
      decision: parsed.decision,
      categories: normalizeCategories(parsed.categories),
      updatedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function serializeConsentRecord(record: CookieConsentRecord): string {
  return encodeURIComponent(JSON.stringify(record));
}

export function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const all = document.cookie || '';
    if (!all) return null;
    for (const part of all.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key === name) return rest.join('=') || '';
    }
  } catch {
    return null;
  }
  return null;
}

export function writeConsentCookie(record: CookieConsentRecord): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_CONSENT_NAME}=${serializeConsentRecord(record)}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

export function deleteConsentCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

export function readStoredConsent(nowDate = new Date()): CookieConsentRecord | null {
  return parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME), nowDate);
}

export function hasConsentForCategory(record: CookieConsentRecord | null, category: CookieConsentCategory): boolean {
  if (category === 'necessary') return true;
  return record?.categories?.[category] === true;
}

export function hasStoredConsentForCategory(category: CookieConsentCategory): boolean {
  return hasConsentForCategory(readStoredConsent(), category);
}

export function clearStorageKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  for (const key of keys) {
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    try {
      window.sessionStorage?.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function getGoogleConsentState(categories: CookieConsentCategories) {
  const analytics = categories.analytics ? 'granted' : 'denied';
  const advertising = categories.advertising ? 'granted' : 'denied';
  const preferences = categories.preferences ? 'granted' : 'denied';

  return {
    analytics_storage: analytics,
    ad_storage: advertising,
    ad_user_data: advertising,
    ad_personalization: advertising,
    personalization_storage: preferences,
    functionality_storage: preferences,
    security_storage: 'granted',
  } as const;
}