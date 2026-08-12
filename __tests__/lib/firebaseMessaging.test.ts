import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onRegistered, register } from 'firebase/messaging';
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

  it('registers FCM with Firebase 12 FID flow after permission has already been granted', async () => {
    applyFirebaseEnv();
    setNotificationPermission('granted');
    const { activeWorker, registration } = setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    let registeredHandler: ((registrationId: string) => void) | null = null;
    const unsubscribeRegistered = jest.fn();
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (onRegistered as jest.Mock).mockImplementation((_messaging, handler) => {
      registeredHandler = handler;
      return unsubscribeRegistered;
    });
    (register as jest.Mock).mockImplementation(async () => {
      registeredHandler?.('firebase-installation-id');
      return undefined;
    });

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({
      ok: true,
      permission: 'granted',
      registrationId: 'firebase-installation-id',
      registrationType: 'fid',
      serviceWorkerScope: registration.scope,
    });
    expect(onRegistered).toHaveBeenCalledWith(messaging, expect.any(Function));
    expect(onRegistered.mock.invocationCallOrder[0]).toBeLessThan(register.mock.invocationCallOrder[0]);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/' });
    expect(activeWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NEWS_PULSE_FIREBASE_CONFIG' })
    );
    expect(register).toHaveBeenCalledWith(messaging, {
      vapidKey: firebaseEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    expect(getToken).not.toHaveBeenCalled();
    expect(unsubscribeRegistered).toHaveBeenCalled();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('requests browser permission from the default state before Firebase 12 FID registration', async () => {
    applyFirebaseEnv();
    setNotificationPermission('default', 'granted');
    setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    let registeredHandler: ((registrationId: string) => void) | null = null;
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (onRegistered as jest.Mock).mockImplementation((_messaging, handler) => {
      registeredHandler = handler;
      return jest.fn();
    });
    (register as jest.Mock).mockImplementation(async () => {
      registeredHandler?.('fid-after-permission-prompt');
      return undefined;
    });

    const result = await registerBrowserForFcm();

    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, permission: 'granted', registrationId: 'fid-after-permission-prompt', registrationType: 'fid' });
    expect(onRegistered.mock.invocationCallOrder[0]).toBeLessThan(register.mock.invocationCallOrder[0]);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('does not interpret the register() return value as the FID', async () => {
    applyFirebaseEnv();
    setNotificationPermission('granted');
    setWebPushSupport();
    const app = { name: '[DEFAULT]' };
    const messaging = { app };
    let registeredHandler: ((registrationId: string) => void) | null = null;
    (isSupported as jest.Mock).mockResolvedValue(true);
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getMessaging as jest.Mock).mockReturnValue(messaging);
    (onRegistered as jest.Mock).mockImplementation((_messaging, handler) => {
      registeredHandler = handler;
      return jest.fn();
    });
    (register as jest.Mock).mockImplementation(async () => {
      registeredHandler?.('fid-from-on-registered');
      return 'do-not-use-this-return-value';
    });

    const result = await registerBrowserForFcm();

    expect(result).toMatchObject({ ok: true, registrationId: 'fid-from-on-registered', registrationType: 'fid' });
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
    (onRegistered as jest.Mock).mockReturnValue(jest.fn());
    (register as jest.Mock).mockRejectedValue(firebaseError);

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