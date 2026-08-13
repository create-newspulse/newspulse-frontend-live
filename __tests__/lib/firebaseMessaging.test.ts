import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import {
  getCurrentNotificationPermission,
  isFirebaseMessagingSupported,
  registerBrowserForFcm,
} from '../../lib/firebaseMessaging';

jest.mock('firebase/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
}));

jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  isSupported: jest.fn(),
  onRegistered: jest.fn(),
  onMessage: jest.fn(),
  register: jest.fn(),
}));

const firebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'news-pulse.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'news-pulse',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'news-pulse.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef',
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'public-vapid-key',
};

function applyFirebaseEnv() {
  Object.assign(process.env, firebaseEnv);
}

function clearFirebaseEnv() {
  Object.keys(firebaseEnv).forEach((key) => {
    delete process.env[key];
  });
}

function setNotificationPermission(permission: NotificationPermission, requestedPermission: NotificationPermission = permission) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission,
      requestPermission: jest.fn().mockResolvedValue(requestedPermission),
    },
  });
}

function setWebPushSupport() {
  const activeWorker = { postMessage: jest.fn(), scriptURL: 'http://localhost/firebase-messaging-sw.js' };
  const registration = {
    active: activeWorker,
    installing: null,
    waiting: null,
    scope: 'http://localhost/',
  };

  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: null,
      register: jest.fn().mockResolvedValue(registration),
    },
  });

  return { activeWorker, registration };
}

describe('lib/firebaseMessaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFirebaseEnv();
    delete (window as any).Notification;
    delete (window as any).PushManager;
    delete (navigator as any).serviceWorker;
  });

  it('reports unsupported browsers without requesting notification permission', async () => {
    setNotificationPermission('default');

    await expect(isFirebaseMessagingSupported()).resolves.toBe(false);
    expect(getCurrentNotificationPermission()).toBe('default');
    expect(isSupported).not.toHaveBeenCalled();
  });

  it('returns a blocked result when notification permission is denied', async () => {
    applyFirebaseEnv();
    setNotificationPermission('denied');
    setWebPushSupport();
    (isSupported as jest.Mock).mockResolvedValue(true);

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({ ok: false, reason: 'permission-blocked', permission: 'denied' });
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('registers FCM with getToken after permission has already been granted', async () => {
    applyFirebaseEnv();
    setNotificationPermission('granted');
    const { activeWorker, registration } = setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (getToken as jest.Mock).mockResolvedValue('fcm-registration-token');

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({
      ok: true,
      permission: 'granted',
      registrationId: 'fcm-registration-token',
      registrationType: 'token',
      serviceWorkerScope: registration.scope,
    });
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/' });
    expect(activeWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NEWS_PULSE_FIREBASE_CONFIG' })
    );
    expect(getToken).toHaveBeenCalledWith(messaging, {
      vapidKey: firebaseEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('requests browser permission from the default state before FCM token registration', async () => {
    applyFirebaseEnv();
    setNotificationPermission('default', 'granted');
    setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (getToken as jest.Mock).mockResolvedValue('fcm-token-after-permission-prompt');

    const result = await registerBrowserForFcm();

    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, permission: 'granted', registrationId: 'fcm-token-after-permission-prompt', registrationType: 'token' });
    expect(getToken).toHaveBeenCalledWith(messaging, expect.objectContaining({ vapidKey: firebaseEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY }));
  });

  it('does not treat an empty FCM token as a successful registration', async () => {
    applyFirebaseEnv();
    setNotificationPermission('granted');
    setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (getToken as jest.Mock).mockResolvedValue('');

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({ ok: false, reason: 'registration-failed', permission: 'granted' });
    expect(errorSpy).toHaveBeenCalledWith('FCM registration failed', expect.objectContaining({
      message: 'Firebase Messaging did not provide an FCM registration token.',
    }));
    errorSpy.mockRestore();
  });

  it('returns an accurate Firebase registration failure and logs safe development details', async () => {
    applyFirebaseEnv();
    setNotificationPermission('granted');
    setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    const firebaseError = Object.assign(new Error('Sender ID mismatch'), {
      name: 'FirebaseError',
      code: 'messaging/mismatched-credential',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (getToken as jest.Mock).mockRejectedValue(firebaseError);

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({
      ok: false,
      reason: 'registration-failed',
      message: 'Firebase Cloud Messaging registration failed.',
    });
    expect(errorSpy).toHaveBeenCalledWith('FCM registration failed', {
      name: 'FirebaseError',
      code: 'messaging/mismatched-credential',
      message: 'Sender ID mismatch',
    });
    errorSpy.mockRestore();
  });
});