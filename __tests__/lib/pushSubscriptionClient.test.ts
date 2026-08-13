import { defaultPushNotificationPreferences } from '../../lib/pushNotificationPreferences';
import {
  PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
  checkNewsPulsePushBackendDiagnostics,
  readStoredPushRegistration,
  registerNewsPulsePushSubscription,
  unregisterNewsPulsePushSubscription,
  updateNewsPulsePushPreferences,
} from '../../lib/pushSubscriptionClient';

describe('lib/pushSubscriptionClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, message: 'ok' }),
    });
  });

  it('registers the FCM token with the backend payload contract', async () => {
    const result = await registerNewsPulsePushSubscription({
      registrationId: 'fcm-token-123',
      permission: 'granted',
      language: 'gu',
      preferences: defaultPushNotificationPreferences,
    });

    expect(result).toMatchObject({ ok: true, registrationId: 'fcm-token-123', registrationType: 'token' });
    expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/register', expect.objectContaining({ method: 'POST' }));
    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      token: 'fcm-token-123',
      registrationType: 'token',
      platform: 'web',
      language: 'gu',
      preferences: {
        breakingNews: true,
        topStories: true,
        newArticleAlerts: true,
        categoryAlerts: true,
        allArticles: false,
      },
      categories: [],
    });
    expect(JSON.parse(init.body).categories).not.toContain('gujaratRegional');
    expect(JSON.parse(init.body).categories).not.toContain('Gujarat/Regional');
    expect(JSON.parse(window.localStorage.getItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY) || '{}')).toMatchObject({
      registrationId: 'fcm-token-123',
      registrationType: 'token',
    });
  });

  it('does not treat fid-only stored registrations as successful push sync', () => {
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'fid-123', registrationType: 'fid', updatedAt: '2026-01-01T00:00:00.000Z' })
    );

    expect(readStoredPushRegistration()).toBeNull();
  });

  it('logs safe register metadata only when FCM test control is enabled', async () => {
    const originalFcmTestControl = process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL;
    const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = 'true';

    try {
      await registerNewsPulsePushSubscription({
        registrationId: 'fcm-token-123',
        permission: 'granted',
        preferences: defaultPushNotificationPreferences,
      });
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = originalFcmTestControl;
    }

    expect(consoleInfo).toHaveBeenCalledWith('push register request sent', 'registrationType=token');
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('fcm-token-123');
    consoleInfo.mockRestore();
  });

  it('normalizes legacy and display category values before backend registration', async () => {
    const preferences = {
      ...defaultPushNotificationPreferences,
      categoryAlerts: {
        selected: ['National', 'Gujarat/Regional', 'gujaratRegional', 'regional', 'Invalid Category', 'Science'] as any,
      },
    };

    const result = await registerNewsPulsePushSubscription({
      registrationId: 'fcm-token-123',
      permission: 'granted',
      preferences,
    });

    expect(result.ok).toBe(true);
    const [, init] = (global as any).fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.preferences.categoryAlerts).toBe(true);
    expect(payload.categories).toEqual(['national', 'gujarat', 'regional', 'science']);
    expect(payload.categories).not.toContain('National');
    expect(payload.categories).not.toContain('Gujarat/Regional');
    expect(payload.categories).not.toContain('gujaratRegional');
    expect(payload.categories).not.toContain('Invalid Category');
  });

  it('syncs changed push preferences without cookie consent categories', async () => {
    const preferences = {
      ...defaultPushNotificationPreferences,
      types: { ...defaultPushNotificationPreferences.types, allArticles: true, categoryAlerts: false },
    };

    const result = await updateNewsPulsePushPreferences({
      registrationId: 'fcm-token-123',
      registrationType: 'token',
      language: 'hi',
      preferences,
    });

    expect(result.ok).toBe(true);
    expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/preferences', expect.objectContaining({ method: 'PUT' }));
    const [, init] = (global as any).fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({
      token: 'fcm-token-123',
      registrationType: 'token',
      platform: 'web',
      language: 'hi',
      preferences: { allArticles: true, categoryAlerts: false },
      categories: [],
    });
    expect(payload.preferences).not.toHaveProperty('analytics');
    expect(payload.preferences).not.toHaveProperty('advertising');
  });

  it('normalizes categories before backend preference sync', async () => {
    const preferences = {
      ...defaultPushNotificationPreferences,
      categoryAlerts: {
        selected: ['International', 'Business', 'Gujarat/Regional', 'unknown'] as any,
      },
    };

    const result = await updateNewsPulsePushPreferences({
      registrationId: 'fcm-token-123',
      registrationType: 'token',
      preferences,
    });

    expect(result.ok).toBe(true);
    const [, init] = (global as any).fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.preferences.categoryAlerts).toBe(true);
    expect(payload.categories).toEqual(['international', 'business', 'gujarat']);
    expect(payload.categories).not.toContain('International');
    expect(payload.categories).not.toContain('Gujarat/Regional');
    expect(payload.categories).not.toContain('unknown');
  });

  it('unregisters backend delivery and clears the stored registration on success', async () => {
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'fcm-token-123', registrationType: 'token', updatedAt: '2026-01-01T00:00:00.000Z' })
    );

    const result = await unregisterNewsPulsePushSubscription({
      registrationId: 'fcm-token-123',
      registrationType: 'token',
    });

    expect(result.ok).toBe(true);
    expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/unregister', expect.objectContaining({ method: 'DELETE' }));
    expect(window.localStorage.getItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY)).toBeNull();
  });

  it('fails gracefully when backend registration fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ ok: false, message: 'backend unavailable' }),
    });

    const result = await registerNewsPulsePushSubscription({
      registrationId: 'fcm-token-123',
      permission: 'granted',
      preferences: defaultPushNotificationPreferences,
    });

    expect(result).toMatchObject({ ok: false, reason: 'backend-registration-failed', message: 'backend unavailable' });
    expect(consoleError).toHaveBeenCalledWith('Push backend sync failed', {
      status: 503,
      message: 'backend unavailable',
    });
    expect(window.localStorage.getItem(PUSH_BACKEND_REGISTRATION_STORAGE_KEY)).toBeNull();
    consoleError.mockRestore();
  });

  it('reads optional backend diagnostics without exposing registration identifiers', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, firebaseBackendConfigured: true, messagingAvailable: true, registrationId: 'not-returned-to-ui' }),
    });

    const result = await checkNewsPulsePushBackendDiagnostics();

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      backendReachable: true,
      firebaseBackendConfigured: true,
      messagingAvailable: true,
    });
    expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/diagnostics', expect.objectContaining({ method: 'GET' }));
    expect(result).not.toHaveProperty('registrationId');
  });
});