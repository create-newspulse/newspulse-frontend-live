import type { FirebaseOptions } from 'firebase/app';
import type { MessagePayload } from 'firebase/messaging';
import { getFirebaseClientApp, getFirebaseClientConfig, isBrowserRuntime } from './firebaseClient';
import type { PushSubscriptionRegistrationResult } from './pushSubscriptionClient';

export const FIREBASE_MESSAGING_SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

export type NotificationPermissionStatus = NotificationPermission | 'unsupported';

export type FcmRegistrationResult =
  | {
      ok: true;
      permission: 'granted';
      registrationId: string;
      registrationType: 'fid';
      serviceWorkerScope: string;
      backendSync: PushSubscriptionRegistrationResult | { ok: false; reason: 'not-requested'; message: string };
    }
  | {
      ok: false;
      reason:
        | 'not-configured'
        | 'unsupported-browser'
        | 'permission-blocked'
        | 'permission-dismissed'
        | 'registration-failed';
      permission: NotificationPermissionStatus;
      missingEnv?: string[];
      message: string;
      error?: unknown;
    };

export type ForegroundFcmMessageSummary = {
  messageId?: string;
  hasNotification: boolean;
  hasData: boolean;
  link?: string;
};

function hasRequiredWebPushApis(): boolean {
  return (
    isBrowserRuntime() &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getCurrentNotificationPermission(): NotificationPermissionStatus {
  if (!isBrowserRuntime() || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export async function isFirebaseMessagingSupported(): Promise<boolean> {
  if (!hasRequiredWebPushApis()) return false;

  try {
    const { isSupported } = await import('firebase/messaging');
    return await isSupported();
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isBrowserRuntime() || !('Notification' in window)) return 'unsupported';
  return await window.Notification.requestPermission();
}

function postFirebaseConfigToServiceWorker(
  registration: ServiceWorkerRegistration,
  config: FirebaseOptions
): void {
  const message = {
    type: 'NEWS_PULSE_FIREBASE_CONFIG',
    config,
  };
  const workers = [
    registration.active,
    registration.waiting,
    registration.installing,
    navigator.serviceWorker.controller,
  ].filter(Boolean) as ServiceWorker[];

  workers.forEach((worker) => worker.postMessage(message));
}

function getSafeFirebaseErrorDetails(error: unknown): { name?: string; code?: string; message?: string } {
  if (!error || typeof error !== 'object') return { message: String(error || '') };
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

function logDevelopmentFirebaseRegistrationError(error: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  console.error('FCM registration failed', getSafeFirebaseErrorDetails(error));
}

export async function ensureFirebaseMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isBrowserRuntime() || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are not available in this browser.');
  }

  const registration = await navigator.serviceWorker.register(FIREBASE_MESSAGING_SERVICE_WORKER_PATH, {
    scope: '/',
  });
  const readyRegistration = registration.active
    ? registration
    : await navigator.serviceWorker.ready.catch(() => registration);
  const configStatus = getFirebaseClientConfig();
  if (configStatus.isConfigured) {
    postFirebaseConfigToServiceWorker(readyRegistration, configStatus.config);
  }
  return readyRegistration;
}

export async function registerBrowserForFcm(): Promise<FcmRegistrationResult> {
  const configStatus = getFirebaseClientConfig();

  if (!configStatus.isConfigured) {
    return {
      ok: false,
      reason: 'not-configured',
      permission: getCurrentNotificationPermission(),
      missingEnv: configStatus.missingEnv,
      message: 'Firebase Cloud Messaging is not configured for this frontend build.',
    };
  }

  if (!(await isFirebaseMessagingSupported())) {
    return {
      ok: false,
      reason: 'unsupported-browser',
      permission: getCurrentNotificationPermission(),
      message: 'This browser does not support Firebase Cloud Messaging web push.',
    };
  }

  const currentPermission = getCurrentNotificationPermission();
  if (currentPermission === 'denied') {
    return {
      ok: false,
      reason: 'permission-blocked',
      permission: currentPermission,
      message: 'Notifications are blocked in this browser.',
    };
  }

  const permission = currentPermission === 'granted' ? currentPermission : await requestNotificationPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: permission === 'denied' ? 'permission-blocked' : 'permission-dismissed',
      permission,
      message: 'Notification permission was not granted.',
    };
  }

  const appResult = getFirebaseClientApp();
  if (!appResult.ok) {
    if (appResult.error) logDevelopmentFirebaseRegistrationError(appResult.error);
    return {
      ok: false,
      reason: appResult.reason === 'not-configured' ? 'not-configured' : 'registration-failed',
      permission,
      missingEnv: appResult.configStatus.missingEnv,
      message: 'Firebase could not be initialized in this browser.',
      error: appResult.error,
    };
  }

  try {
    const { getMessaging, onRegistered, register: registerMessaging } = await import('firebase/messaging');
    const serviceWorkerRegistration = await ensureFirebaseMessagingServiceWorker();
    const messaging = getMessaging(appResult.app);

    let unsubscribeRegistered: (() => void) | undefined;
    let registrationTimeout: number | undefined;
    const registeredIdPromise = new Promise<string>((resolve, reject) => {
      registrationTimeout = window.setTimeout(() => {
        reject(new Error('Firebase Messaging registration did not provide a Firebase Installation ID.'));
      }, 15000);

      unsubscribeRegistered = onRegistered(messaging, (registrationId) => {
        const normalizedRegistrationId = String(registrationId || '').trim();
        if (registrationTimeout) window.clearTimeout(registrationTimeout);
        if (!normalizedRegistrationId) {
          reject(new Error('Firebase Messaging registration provided an empty Firebase Installation ID.'));
          return;
        }
        resolve(normalizedRegistrationId);
      });
    });
    registeredIdPromise.catch(() => {});

    try {
      await registerMessaging(messaging, {
        vapidKey: appResult.configStatus.vapidKey,
        serviceWorkerRegistration,
      });
      const registrationId = await registeredIdPromise;
      const backendSync = {
        ok: false as const,
        reason: 'not-requested' as const,
        message: 'Backend subscription sync is handled by the News Pulse settings panel.',
      };

      return {
        ok: true,
        permission,
        registrationId,
        registrationType: 'fid',
        serviceWorkerScope: serviceWorkerRegistration.scope,
        backendSync,
      };
    } finally {
      if (registrationTimeout) window.clearTimeout(registrationTimeout);
      unsubscribeRegistered?.();
    }
  } catch (error) {
    logDevelopmentFirebaseRegistrationError(error);
    return {
      ok: false,
      reason: 'registration-failed',
      permission,
      message: 'Firebase Cloud Messaging registration failed.',
      error,
    };
  }
}

export async function listenForForegroundFcmMessages(
  onForegroundMessage: (payload: MessagePayload) => void,
  onError?: (error: unknown) => void
): Promise<() => void> {
  if (!(await isFirebaseMessagingSupported())) return () => {};

  const appResult = getFirebaseClientApp();
  if (!appResult.ok) return () => {};

  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    return onMessage(getMessaging(appResult.app), onForegroundMessage);
  } catch (error) {
    onError?.(error);
    return () => {};
  }
}

export function summarizeForegroundFcmMessage(payload: MessagePayload): ForegroundFcmMessageSummary {
  return {
    messageId: payload.messageId,
    hasNotification: Boolean(payload.notification),
    hasData: Boolean(payload.data && Object.keys(payload.data).length > 0),
    link: payload.fcmOptions?.link || payload.data?.link,
  };
}