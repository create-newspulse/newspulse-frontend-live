export const PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY = 'np_push_notification_preferences_v1';

export type PushNotificationTypeKey =
  | 'breakingNews'
  | 'topStories'
  | 'newArticleAlerts'
  | 'categoryAlerts'
  | 'allArticles';

export type NewsPulsePushCategoryKey =
  | 'national'
  | 'international'
  | 'business'
  | 'technology'
  | 'science'
  | 'sports'
  | 'entertainment'
  | 'regional'
  | 'gujarat';

export type PushNotificationPreferences = {
  version: 1;
  enabled: boolean;
  types: Record<PushNotificationTypeKey, boolean>;
  categoryAlerts: {
    selected: NewsPulsePushCategoryKey[];
  };
  updatedAt: string | null;
};

export const supportedNewsPulsePushCategories: Array<{ key: NewsPulsePushCategoryKey; label: string }> = [
  { key: 'national', label: 'National' },
  { key: 'international', label: 'International' },
  { key: 'business', label: 'Business' },
  { key: 'technology', label: 'Technology' },
  { key: 'science', label: 'Science' },
  { key: 'sports', label: 'Sports' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'gujarat', label: 'Gujarat/Regional' },
];

const pushCategoryAliases: Record<string, NewsPulsePushCategoryKey> = {
  national: 'national',
  international: 'international',
  business: 'business',
  technology: 'technology',
  science: 'science',
  sports: 'sports',
  entertainment: 'entertainment',
  regional: 'regional',
  gujarat: 'gujarat',
  gujaratregional: 'gujarat',
};

export const defaultPushNotificationPreferences: PushNotificationPreferences = {
  version: 1,
  enabled: false,
  types: {
    breakingNews: true,
    topStories: true,
    newArticleAlerts: true,
    categoryAlerts: true,
    allArticles: false,
  },
  categoryAlerts: {
    selected: [],
  },
  updatedAt: null,
};

export function normalizeNewsPulsePushCategoryId(value: unknown): NewsPulsePushCategoryKey | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return pushCategoryAliases[normalized] || null;
}

export function normalizeNewsPulsePushCategoryIds(values: unknown): NewsPulsePushCategoryKey[] {
  if (!Array.isArray(values)) return [];
  const selected: NewsPulsePushCategoryKey[] = [];
  const seen = new Set<NewsPulsePushCategoryKey>();
  values.forEach((value) => {
    const category = normalizeNewsPulsePushCategoryId(value);
    if (!category || seen.has(category)) return;
    seen.add(category);
    selected.push(category);
  });
  return selected;
}

function normalizePushNotificationPreferences(value: unknown): PushNotificationPreferences {
  if (!value || typeof value !== 'object') return defaultPushNotificationPreferences;
  const stored = value as Partial<PushNotificationPreferences>;
  const storedTypes: Partial<Record<PushNotificationTypeKey, boolean>> = stored.types || {};
  const storedCategories = stored.categoryAlerts?.selected || defaultPushNotificationPreferences.categoryAlerts.selected;

  return {
    version: 1,
    enabled: Boolean(stored.enabled),
    types: {
      breakingNews: typeof storedTypes.breakingNews === 'boolean' ? storedTypes.breakingNews : true,
      topStories: typeof storedTypes.topStories === 'boolean' ? storedTypes.topStories : true,
      newArticleAlerts: typeof storedTypes.newArticleAlerts === 'boolean' ? storedTypes.newArticleAlerts : true,
      categoryAlerts: typeof storedTypes.categoryAlerts === 'boolean' ? storedTypes.categoryAlerts : true,
      allArticles: typeof storedTypes.allArticles === 'boolean' ? storedTypes.allArticles : false,
    },
    categoryAlerts: {
      selected: normalizeNewsPulsePushCategoryIds(storedCategories),
    },
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : null,
  };
}

export function readPushNotificationPreferences(): PushNotificationPreferences {
  if (typeof window === 'undefined') return defaultPushNotificationPreferences;
  try {
    const raw = window.localStorage.getItem(PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY);
    return normalizePushNotificationPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultPushNotificationPreferences;
  }
}

export function hasStoredPushNotificationPreferences(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function writePushNotificationPreferences(
  preferences: PushNotificationPreferences
): PushNotificationPreferences {
  const next: PushNotificationPreferences = {
    ...normalizePushNotificationPreferences(preferences),
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return next;
}