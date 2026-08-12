import type { Lang } from '../src/i18n/LanguageProvider';
import {
  normalizeNewsPulsePushCategoryIds,
  type NewsPulsePushCategoryKey,
  type PushNotificationPreferences,
} from './pushNotificationPreferences';

export const PUSH_REGISTRATION_TYPE = 'fid' as const;
export const PUSH_BACKEND_REGISTRATION_STORAGE_KEY = 'np_push_backend_registration_v1';

export type PushSubscriptionRegistrationInput = {
  registrationId: string;
  permission: NotificationPermission;
  language?: Lang;
  preferences?: PushNotificationPreferences;
};

export type PushRegistrationIdentifier = {
  registrationId: string;
  registrationType: typeof PUSH_REGISTRATION_TYPE;
};

export type PushSubscriptionRegistrationResult = PushRegistrationIdentifier & {
  ok: boolean;
  status?: number;
  reason?: 'backend-registration-failed' | 'network-error' | 'invalid-registration-id';
  message: string;
};

export type PushSubscriptionPreferenceSyncInput = PushRegistrationIdentifier & {
  language?: Lang;
  preferences: PushNotificationPreferences;
};

export type PushSubscriptionUnregisterInput = PushRegistrationIdentifier & {
  language?: Lang;
};

export type PushSubscriptionMutationResult = {
  ok: boolean;
  status?: number;
  reason?: 'backend-request-failed' | 'network-error' | 'invalid-registration-id';
  message: string;
};

export type PushBackendDiagnosticsResult = {
  ok: boolean;
  status?: number;
  backendReachable: boolean;
  firebaseBackendConfigured?: boolean;
  messagingAvailable?: boolean;
  message: string;
};

export type StoredPushRegistration = PushRegistrationIdentifier & {
  updatedAt: string;
};

type PushBackendPayload = {
  registrationId: string;
  registrationType: typeof PUSH_REGISTRATION_TYPE;
  platform: 'web';
  language: Lang;
  preferences: Record<string, boolean>;
  categories: NewsPulsePushCategoryKey[];
};

function normalizeLanguage(language: Lang | undefined): Lang {
  return language === 'hi' || language === 'gu' ? language : 'en';
}

function normalizeRegistrationId(value: unknown): string {
  return String(value || '').trim();
}

export function readStoredPushRegistration(): StoredPushRegistration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPushRegistration>;
    const registrationId = normalizeRegistrationId(parsed.registrationId);
    if (!registrationId || parsed.registrationType !== PUSH_REGISTRATION_TYPE) return null;
    return {
      registrationId,
      registrationType: PUSH_REGISTRATION_TYPE,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStoredPushRegistration(registration: PushRegistrationIdentifier): StoredPushRegistration | null {
  const registrationId = normalizeRegistrationId(registration.registrationId);
  if (!registrationId || typeof window === 'undefined') return null;
  const next: StoredPushRegistration = {
    registrationId,
    registrationType: PUSH_REGISTRATION_TYPE,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearStoredPushRegistration(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY);
  } catch {}
}

function buildPushPreferencesPayload(preferences: PushNotificationPreferences): Record<string, boolean> {
  return {
    breakingNews: Boolean(preferences.types.breakingNews),
    topStories: Boolean(preferences.types.topStories),
    newArticleAlerts: Boolean(preferences.types.newArticleAlerts),
    categoryAlerts: Boolean(preferences.types.categoryAlerts),
    allArticles: Boolean(preferences.types.allArticles),
  };
}

function buildPushBackendPayload(input: {
  registrationId: string;
  language?: Lang;
  preferences: PushNotificationPreferences;
}): PushBackendPayload {
  const categories = input.preferences.types.categoryAlerts
    ? normalizeNewsPulsePushCategoryIds(input.preferences.categoryAlerts.selected)
    : [];

  return {
    registrationId: input.registrationId,
    registrationType: PUSH_REGISTRATION_TYPE,
    platform: 'web',
    language: normalizeLanguage(input.language),
    preferences: buildPushPreferencesPayload(input.preferences),
    categories,
  };
}

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readBooleanLike(source: any, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'available', 'configured', 'ok'].includes(normalized)) return true;
      if (['false', 'no', 'unavailable', 'not configured', 'missing', 'failed'].includes(normalized)) return false;
    }
  }
  return undefined;
}

export async function checkNewsPulsePushBackendDiagnostics(): Promise<PushBackendDiagnosticsResult> {
  try {
    const response = await fetch('/api/public/push/diagnostics', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const json = await readJsonResponse(response);
    const backendReachable = response.ok && json?.ok !== false;
    return {
      ok: backendReachable,
      status: response.status,
      backendReachable,
      firebaseBackendConfigured: readBooleanLike(json, ['firebaseBackendConfigured', 'firebaseConfigured', 'firebaseAdminConfigured', 'firebaseBackend']),
      messagingAvailable: readBooleanLike(json, ['messagingAvailable', 'firebaseMessagingAvailable', 'messaging']),
      message: String(json?.message || json?.error || (backendReachable ? 'Push diagnostics available.' : 'Push diagnostics unavailable.')),
    };
  } catch {
    return {
      ok: false,
      backendReachable: false,
      message: 'Push diagnostics endpoint is currently unreachable.',
    };
  }
}

async function sendPushBackendRequest(
  path: '/api/public/push/register' | '/api/public/push/preferences' | '/api/public/push/unregister',
  method: 'POST' | 'PUT' | 'DELETE',
  payload: PushBackendPayload | PushRegistrationIdentifier
): Promise<PushSubscriptionMutationResult> {
  try {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await readJsonResponse(response);
    if (!response.ok || json?.ok === false) {
      const message = String(json?.message || json?.error || 'Push notification backend request failed.');
      logDevelopmentPushBackendSyncFailure(response.status, message);
      return {
        ok: false,
        status: response.status,
        reason: 'backend-request-failed',
        message,
      };
    }
    return {
      ok: true,
      status: response.status,
      message: String(json?.message || 'Push notification backend request completed.'),
    };
  } catch {
    const message = 'Push notification backend is currently unreachable.';
    logDevelopmentPushBackendSyncFailure(undefined, message);
    return {
      ok: false,
      reason: 'network-error',
      message,
    };
  }
}

function logDevelopmentPushBackendSyncFailure(status: number | undefined, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  console.error('Push backend sync failed', {
    status,
    message,
  });
}

export async function registerNewsPulsePushSubscription(
  input: PushSubscriptionRegistrationInput
): Promise<PushSubscriptionRegistrationResult> {
  const registrationId = normalizeRegistrationId(input.registrationId);
  if (!registrationId) {
    return {
      ok: false,
      registrationId: '',
      registrationType: PUSH_REGISTRATION_TYPE,
      reason: 'invalid-registration-id',
      message: 'Firebase did not provide a valid push registration identifier.',
    };
  }

  const preferences = input.preferences;
  if (!preferences) {
    return {
      ok: false,
      registrationId,
      registrationType: PUSH_REGISTRATION_TYPE,
      reason: 'backend-registration-failed',
      message: 'Push notification preferences are required before backend registration.',
    };
  }

  const result = await sendPushBackendRequest(
    '/api/public/push/register',
    'POST',
    buildPushBackendPayload({ registrationId, language: input.language, preferences })
  );

  const reason: PushSubscriptionRegistrationResult['reason'] = result.ok
    ? undefined
    : result.reason === 'network-error'
      ? 'network-error'
      : 'backend-registration-failed';
  const registrationResult: PushSubscriptionRegistrationResult = {
    ...result,
    registrationId,
    registrationType: PUSH_REGISTRATION_TYPE,
    reason,
  };

  if (registrationResult.ok) {
    writeStoredPushRegistration(registrationResult);
  } else {
    clearStoredPushRegistration();
  }

  return registrationResult;
}

export async function updateNewsPulsePushPreferences(
  input: PushSubscriptionPreferenceSyncInput
): Promise<PushSubscriptionMutationResult> {
  const registrationId = normalizeRegistrationId(input.registrationId);
  if (!registrationId) {
    return { ok: false, reason: 'invalid-registration-id', message: 'Push registration identifier is missing.' };
  }
  return sendPushBackendRequest(
    '/api/public/push/preferences',
    'PUT',
    buildPushBackendPayload({ registrationId, language: input.language, preferences: input.preferences })
  );
}

export async function unregisterNewsPulsePushSubscription(
  input: PushSubscriptionUnregisterInput
): Promise<PushSubscriptionMutationResult> {
  const registrationId = normalizeRegistrationId(input.registrationId);
  if (!registrationId) {
    return { ok: false, reason: 'invalid-registration-id', message: 'Push registration identifier is missing.' };
  }
  const result = await sendPushBackendRequest('/api/public/push/unregister', 'DELETE', {
    registrationId,
    registrationType: PUSH_REGISTRATION_TYPE,
  });
  if (result.ok) clearStoredPushRegistration();
  return result;
}