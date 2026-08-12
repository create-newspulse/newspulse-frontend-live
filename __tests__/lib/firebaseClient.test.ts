import { getApps, initializeApp } from 'firebase/app';
import { getFirebaseClientApp, getFirebaseClientConfig } from '../../lib/firebaseClient';

jest.mock('firebase/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
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

describe('lib/firebaseClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFirebaseEnv();
  });

  it('reports missing public Firebase configuration without initializing Firebase', () => {
    const configStatus = getFirebaseClientConfig();
    const appResult = getFirebaseClientApp();

    expect(configStatus.isConfigured).toBe(false);
    expect(configStatus.missingEnv).toEqual(
      expect.arrayContaining([
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
        'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
      ])
    );
    expect(appResult).toMatchObject({ ok: false, reason: 'not-configured' });
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('uses an existing Firebase app instead of initializing a duplicate app', () => {
    applyFirebaseEnv();
    const existingApp = { name: '[DEFAULT]' };
    (getApps as jest.Mock).mockReturnValue([existingApp]);

    const appResult = getFirebaseClientApp();

    expect(appResult).toMatchObject({ ok: true, app: existingApp });
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('initializes Firebase once when config is complete and no app exists', () => {
    applyFirebaseEnv();
    const app = { name: '[DEFAULT]' };
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue(app);

    const appResult = getFirebaseClientApp();

    expect(appResult).toMatchObject({ ok: true, app });
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: firebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: firebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: firebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: firebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
    );
  });

  it('normalizes copied JSON-style public Firebase env values without leaking secrets', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = '"api-key",';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = '"news-pulse.firebaseapp.com",';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = '"news-pulse",';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = '"news-pulse.appspot.com",';
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abcdef';
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'public-vapid-key';

    const configStatus = getFirebaseClientConfig();

    expect(configStatus).toMatchObject({
      isConfigured: true,
      missingEnv: [],
      vapidKey: 'public-vapid-key',
      config: {
        apiKey: 'api-key',
        authDomain: 'news-pulse.firebaseapp.com',
        projectId: 'news-pulse',
        storageBucket: 'news-pulse.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef',
      },
    });
  });
});