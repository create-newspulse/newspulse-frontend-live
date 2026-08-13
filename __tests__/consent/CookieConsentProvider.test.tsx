import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CookieConsentProvider, useCookieConsent } from '../../src/consent/CookieConsentProvider';
import EmbeddedMediaConsentGate from '../../src/consent/EmbeddedMediaConsentGate';
import { COOKIE_CONSENT_NAME, createConsentRecord, parseConsentRecord, readCookieValue, writeConsentCookie } from '../../src/consent/cookieConsent';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';
import { getFirebaseClientConfig } from '../../lib/firebaseClient';
import { getCurrentNotificationPermission, isFirebaseMessagingSupported, registerBrowserForFcm } from '../../lib/firebaseMessaging';
import { PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY, readPushNotificationPreferences } from '../../lib/pushNotificationPreferences';
import { PUSH_BACKEND_REGISTRATION_STORAGE_KEY } from '../../lib/pushSubscriptionClient';

jest.mock('next/script', () => function MockScript(props: any) {
  const { children, dangerouslySetInnerHTML, ...rest } = props;
  return <script data-testid="next-script" {...rest} dangerouslySetInnerHTML={dangerouslySetInnerHTML}>{children}</script>;
});

jest.mock('../../lib/firebaseClient', () => ({
  getFirebaseClientConfig: jest.fn(),
}));

jest.mock('../../lib/firebaseMessaging', () => ({
  getCurrentNotificationPermission: jest.fn(),
  isFirebaseMessagingSupported: jest.fn(),
  registerBrowserForFcm: jest.fn(),
}));

function renderWithProviders(children: React.ReactNode = <div />, initialLang: 'en' | 'hi' | 'gu' = 'en') {
  return render(
    <LanguageProvider initialLang={initialLang}>
      <CookieConsentProvider>{children}</CookieConsentProvider>
    </LanguageProvider>
  );
}

function FooterSettingsProbe() {
  const { openPreferences } = useCookieConsent();
  return <button type="button" onClick={openPreferences}>Cookie Settings</button>;
}

function getPushDiagnosticsText(): string {
  return screen.getByTestId('push-diagnostics').textContent || '';
}

describe('CookieConsentProvider', () => {
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
  const originalAdsenseId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
  const originalFcmTestControl = process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL;

  beforeEach(() => {
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    jest.resetAllMocks();
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123';
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = 'pub-test123';
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = 'false';
    window.scrollTo = jest.fn();
    window.localStorage.clear();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, message: 'ok' }),
    });
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({
      isConfigured: false,
      config: {},
      vapidKey: '',
      missingEnv: ['NEXT_PUBLIC_FIREBASE_API_KEY'],
    });
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('unsupported');
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(false);
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'not-configured',
      permission: 'unsupported',
      message: 'Firebase Cloud Messaging is not configured for this frontend build.',
    });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = originalAdsenseId;
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = originalFcmTestControl;
  });

  test('first visit shows banner and does not load optional Google scripts', async () => {
    renderWithProviders();

    expect(await screen.findByText('Your privacy choices')).toBeTruthy();
    expect(screen.queryByText('https://www.googletagmanager.com/gtag/js?id=G-TEST123')).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')).toBeNull();
    expect(document.querySelector('script[src*="fundingchoicesmessages.google.com"]')).toBeNull();
  });

  test('accept all stores every optional category and loads one Google tag path', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept All' }));

    const stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.categories).toMatchObject({ preferences: true, analytics: true, advertising: true, embeddedMedia: true });

    await waitFor(() => {
      expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length).toBeLessThanOrEqual(1);
    });
  });

  test('reject non-essential disables every optional category', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Reject Non-Essential' }));

    const stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.decision).toBe('rejected');
    expect(stored?.categories).toMatchObject({ necessary: true, preferences: false, analytics: false, advertising: false, embeddedMedia: false });
  });

  test('custom preferences save correctly and keyboard escape closes the modal', async () => {
    renderWithProviders(<FooterSettingsProbe />);

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Strictly Necessary' })).toBeNull();
    expect(screen.getByTestId('cookie-switch-strictly-necessary').getAttribute('aria-label')).toBe('Strictly Necessary always enabled');

    fireEvent.click(screen.getByRole('switch', { name: 'Preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));

    let stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.categories).toMatchObject({ preferences: true, analytics: false, advertising: false, embeddedMedia: false });

    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.decision).toBe('custom');
  });

  test('modal has an internal scroll area and constrained dialog height', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    const overlay = screen.getByTestId('cookie-preferences-overlay');
    const dialog = screen.getByTestId('cookie-preferences-dialog');
    const scrollArea = screen.getByTestId('cookie-preferences-scroll-area');
    const footer = screen.getByTestId('cookie-preferences-footer');

    expect(overlay.className).toContain('items-center');
    expect(overlay.className).toContain('overflow-hidden');
    expect(overlay.className).toContain('overscroll-none');
    expect(dialog.className).toContain('flex-col');
    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.getAttribute('style')).toContain('height: min(90vh, calc(100dvh - 1rem))');
    expect(dialog.getAttribute('style')).toContain('max-height: min(90vh, calc(100dvh - 1rem))');
    expect(scrollArea.className).toContain('min-h-0');
    expect(scrollArea.className).toContain('flex-1');
    expect(scrollArea.className).toContain('touch-pan-y');
    expect(scrollArea.className).toContain('overflow-x-hidden');
    expect(scrollArea.className).toContain('overflow-y-auto');
    expect(scrollArea.getAttribute('style')).toContain('-webkit-overflow-scrolling: touch');
    expect(footer.className).toContain('flex-shrink-0');
    expect(footer.className).toContain('sm:justify-end');
    expect(footer.className).not.toContain('sm:grid-cols-3');
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeTruthy();
  });

  test('switches expose state and move the thumb visually', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    const preferences = screen.getByRole('switch', { name: 'Preferences' });
    const preferencesThumb = screen.getByTestId('cookie-switch-thumb-preferences');
    expect(preferences.getAttribute('aria-checked')).toBe('false');
    expect((preferences as HTMLElement).style.width).toBe('56px');
    expect((preferences as HTMLElement).style.height).toBe('32px');
    expect((preferences as HTMLElement).style.backgroundColor).toBe('rgb(203, 213, 225)');
    expect(screen.getByTestId('cookie-control-preferences').textContent).toContain('Disabled');
    expect((preferencesThumb as HTMLElement).style.transform).toBe('translateX(0)');

    fireEvent.click(preferences);
    expect(preferences.getAttribute('aria-checked')).toBe('true');
    expect((preferences as HTMLElement).style.backgroundColor).toBe('rgb(15, 23, 42)');
    expect(screen.getByTestId('cookie-control-preferences').textContent).toContain('Enabled');
    expect((preferencesThumb as HTMLElement).style.transform).toBe('translateX(24px)');

    fireEvent.click(preferences);
    expect(preferences.getAttribute('aria-checked')).toBe('false');
    expect((preferences as HTMLElement).style.backgroundColor).toBe('rgb(203, 213, 225)');
    expect((preferencesThumb as HTMLElement).style.transform).toBe('translateX(0)');
  });

  test('strictly necessary remains locked on and optional switches follow visual state', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    const necessary = screen.getByTestId('cookie-switch-strictly-necessary');
    const necessaryThumb = screen.getByTestId('cookie-switch-thumb-strictly-necessary');
    expect(screen.queryByRole('switch', { name: 'Strictly Necessary' })).toBeNull();
    expect(necessary.tagName).toBe('SPAN');
    expect((necessary as HTMLElement).style.backgroundColor).toBe('rgb(15, 23, 42)');
    expect(screen.getByTestId('cookie-control-strictly-necessary').textContent).toContain('Always enabled');
    expect((necessaryThumb as HTMLElement).style.transform).toBe('translateX(24px)');

    for (const label of ['Analytics', 'Advertising', 'Embedded Media']) {
      const switchButton = screen.getByRole('switch', { name: label });
      const thumb = screen.getByTestId(`cookie-switch-thumb-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      expect(switchButton.getAttribute('aria-checked')).toBe('false');
      expect((switchButton as HTMLElement).style.backgroundColor).toBe('rgb(203, 213, 225)');
      expect((thumb as HTMLElement).style.transform).toBe('translateX(0)');
      fireEvent.click(switchButton);
      expect(switchButton.getAttribute('aria-checked')).toBe('true');
      expect((switchButton as HTMLElement).style.backgroundColor).toBe('rgb(15, 23, 42)');
      expect((thumb as HTMLElement).style.transform).toBe('translateX(24px)');
    }
  });

  test('push notification card appears after preferences and before analytics without changing cookie categories', async () => {
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    const scrollAreaText = screen.getByTestId('cookie-preferences-scroll-area').textContent || '';
    expect(scrollAreaText.indexOf('Strictly Necessary')).toBeLessThan(scrollAreaText.indexOf('Preferences'));
    expect(scrollAreaText.indexOf('Preferences')).toBeLessThan(scrollAreaText.indexOf('Push Notifications'));
    expect(scrollAreaText.indexOf('Push Notifications')).toBeLessThan(scrollAreaText.indexOf('Analytics'));
    expect(screen.getByText('Receive News Pulse news alerts and article updates on this device.')).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Push Status' })).toBeNull();
    expect(scrollAreaText).not.toContain('Browser permission');
    expect(scrollAreaText).not.toContain('Service worker');
    expect(scrollAreaText).not.toContain('Firebase registration');
    expect(scrollAreaText).not.toContain('News Pulse server sync');
    expect(scrollAreaText).not.toContain('Preferences sync');
    expect(scrollAreaText).not.toContain('Backend reachable');
    expect(scrollAreaText).not.toContain('Firebase backend');
    expect(scrollAreaText).not.toContain('Messaging available');
    expect(scrollAreaText).not.toContain('Last updated');

    fireEvent.click(screen.getByRole('switch', { name: 'Preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));

    const stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.categories).toMatchObject({ preferences: true, analytics: false, advertising: false, embeddedMedia: false });
    expect(stored?.categories as any).not.toHaveProperty('pushNotifications');
  });

  test('enable notifications requests permission through FCM only after clicking the push toggle', async () => {
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('default');
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: true,
      permission: 'granted',
      registrationId: 'test-fcm-token',
      registrationType: 'token',
      serviceWorkerScope: 'http://localhost/',
      backendSync: { ok: false, reason: 'not-requested', message: 'Backend subscription sync is disabled until the News Pulse backend phase adds an endpoint.' },
    });

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    expect(registerBrowserForFcm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are off'));

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    await waitFor(() => expect(registerBrowserForFcm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/register', expect.any(Object)));
    expect(await screen.findByText('Enabled')).toBeTruthy();
    expect(screen.getByTestId('push-notification-types')).toBeTruthy();
    expect(screen.getByText('Notifications enabled and synced')).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();

    const [, registerInit] = (global as any).fetch.mock.calls.find(([url]: any[]) => url === '/api/public/push/register');
    expect(registerInit.method).toBe('POST');
    const registerPayload = JSON.parse(registerInit.body);
    expect(registerPayload.token).toBeTruthy();
    expect(registerPayload).toMatchObject({
      token: 'test-fcm-token',
      registrationType: 'token',
      platform: 'web',
      language: 'en',
      preferences: {
        breakingNews: true,
        topStories: true,
        newArticleAlerts: true,
        categoryAlerts: true,
        allArticles: false,
      },
      categories: [],
    });
    expect(JSON.parse(registerInit.body).categories).not.toContain('gujaratRegional');
    expect(JSON.parse(registerInit.body).categories).not.toContain('Gujarat/Regional');

    const preferences = readPushNotificationPreferences();
    expect(preferences.enabled).toBe(true);
    expect(preferences.types).toMatchObject({
      breakingNews: true,
      topStories: true,
      newArticleAlerts: true,
      categoryAlerts: true,
      allArticles: false,
    });
  });

  test('save preferences after turning push on waits for token registration before synced state', async () => {
    let resolveRegistration: (value: Awaited<ReturnType<typeof registerBrowserForFcm>>) => void = () => {};
    const registrationPromise = new Promise<Awaited<ReturnType<typeof registerBrowserForFcm>>>((resolve) => {
      resolveRegistration = resolve;
    });
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValueOnce('default').mockReturnValue('granted');
    (registerBrowserForFcm as jest.Mock).mockReturnValue(registrationPromise);

    renderWithProviders(<FooterSettingsProbe />);

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    await waitFor(() => expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are off'));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));
    await waitFor(() => expect(registerBrowserForFcm).toHaveBeenCalledTimes(1));
    expect((global as any).fetch).not.toHaveBeenCalledWith('/api/public/push/register', expect.any(Object));
    expect(screen.queryByText('Notifications enabled and synced')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((global as any).fetch).not.toHaveBeenCalledWith('/api/public/push/register', expect.any(Object));

    await act(async () => {
      resolveRegistration({
        ok: true,
        permission: 'granted',
        registrationId: 'save-flow-fcm-token',
        registrationType: 'token',
        serviceWorkerScope: 'http://localhost/',
        backendSync: { ok: false, reason: 'not-requested', message: 'Backend sync handled by settings.' },
      });
      await registrationPromise;
    });

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/register', expect.any(Object)));
    const [, registerInit] = (global as any).fetch.mock.calls.find(([url]: any[]) => url === '/api/public/push/register');
    expect(JSON.parse(registerInit.body)).toMatchObject({
      token: 'save-flow-fcm-token',
      registrationType: 'token',
      preferences: {
        breakingNews: true,
        topStories: true,
        newArticleAlerts: true,
        categoryAlerts: true,
        allArticles: false,
      },
      categories: [],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    expect(await screen.findByText('Notifications enabled and synced')).toBeTruthy();
  });

  test('denied browser permission shows blocked state and does not request permission again', async () => {
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('denied');

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    expect(await screen.findByText('Notifications are blocked in your browser settings')).toBeTruthy();
    expect(screen.getByText("Notifications are blocked in your browser. Allow notifications in your browser's site settings to receive News Pulse alerts.")).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect(screen.queryByText('Firebase Cloud Messaging registration failed.')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));
    expect(registerBrowserForFcm).not.toHaveBeenCalled();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  test('window focus refresh clears stale blocked state after browser permission is granted', async () => {
    window.localStorage.setItem(
      PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        types: { breakingNews: true, topStories: true, newArticleAlerts: true, categoryAlerts: true, allArticles: false },
        categoryAlerts: { selected: ['national'] },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'stored-fcm-token', registrationType: 'token', updatedAt: '2026-01-01T00:00:00.000Z' })
    );
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValueOnce('denied').mockReturnValue('granted');

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    expect(await screen.findByText('Notifications are blocked in your browser settings')).toBeTruthy();

    fireEvent.focus(window);

    expect(await screen.findByText('Enabled')).toBeTruthy();
    expect(screen.getByText('Notifications enabled and synced')).toBeTruthy();
    expect(screen.queryByText('Notifications are blocked in your browser settings')).toBeNull();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect(registerBrowserForFcm).not.toHaveBeenCalled();
  });

  test('granted state with a stored backend registration does not duplicate registration', async () => {
    window.localStorage.setItem(
      PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        types: { breakingNews: true, topStories: true, newArticleAlerts: true, categoryAlerts: true, allArticles: false },
        categoryAlerts: { selected: ['national'] },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'stored-fcm-token', registrationType: 'token', updatedAt: '2026-01-01T00:00:00.000Z' })
    );
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('granted');

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));

    expect(await screen.findByText('Enabled')).toBeTruthy();
    expect(registerBrowserForFcm).not.toHaveBeenCalled();
    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Notifications enabled and synced')).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
  });

  test('granted notification state registers FCM, syncs language, and preserves local notification type preferences', async () => {
    window.localStorage.setItem(
      PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        types: { breakingNews: false, topStories: true, newArticleAlerts: true, categoryAlerts: true, allArticles: false },
        categoryAlerts: { selected: ['national', 'sports'] },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('granted');
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: true,
      permission: 'granted',
      registrationId: 'test-fcm-token',
      registrationType: 'token',
      serviceWorkerScope: 'http://localhost/',
      backendSync: { ok: false, reason: 'not-requested', message: 'Backend subscription sync is disabled until the News Pulse backend phase adds an endpoint.' },
    });

    renderWithProviders(<FooterSettingsProbe />, 'hi');

    fireEvent.click(await screen.findByRole('button', { name: 'Cookie Settings' }));

    await waitFor(() => expect(registerBrowserForFcm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/register', expect.any(Object)));
    expect(await screen.findByText('Enabled')).toBeTruthy();
    expect(screen.getByText('Notifications enabled and synced')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Breaking News' }).getAttribute('aria-checked')).toBe('false');

    const [, registerInit] = (global as any).fetch.mock.calls.find(([url]: any[]) => url === '/api/public/push/register');
    expect(JSON.parse(registerInit.body)).toMatchObject({
      token: 'test-fcm-token',
      registrationType: 'token',
      language: 'hi',
      categories: ['national', 'sports'],
    });

    fireEvent.click(screen.getByRole('switch', { name: 'All Articles' }));

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/preferences', expect.any(Object)));
    const [, updateInit] = (global as any).fetch.mock.calls.find(([url]: any[]) => url === '/api/public/push/preferences');
    expect(updateInit.method).toBe('PUT');
    expect(JSON.parse(updateInit.body)).toMatchObject({
      token: 'test-fcm-token',
      registrationType: 'token',
      language: 'hi',
      preferences: { allArticles: true },
      categories: ['national', 'sports'],
    });

    const preferences = readPushNotificationPreferences();
    expect(preferences.types.breakingNews).toBe(false);
    expect(preferences.types.allArticles).toBe(true);
    expect(preferences.categoryAlerts.selected).toEqual(['national', 'sports']);
  });

  test('turning the master switch off unregisters backend delivery without clearing other preferences', async () => {
    window.localStorage.setItem(
      PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        types: { breakingNews: true, topStories: true, newArticleAlerts: true, categoryAlerts: true, allArticles: false },
        categoryAlerts: { selected: ['business'] },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'stored-fcm-token', registrationType: 'token', updatedAt: '2026-01-01T00:00:00.000Z' })
    );
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('granted');

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    expect(await screen.findByText('Enabled')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/unregister', expect.any(Object)));
    const [, unregisterInit] = (global as any).fetch.mock.calls.find(([url]: any[]) => url === '/api/public/push/unregister');
    expect(unregisterInit.method).toBe('DELETE');
    expect(JSON.parse(unregisterInit.body)).toEqual({
      token: 'stored-fcm-token',
      registrationType: 'token',
    });

    const preferences = readPushNotificationPreferences();
    expect(preferences.enabled).toBe(false);
    expect(preferences.types.breakingNews).toBe(true);
    expect(preferences.categoryAlerts.selected).toEqual(['business']);
  });

  test('backend registration failure keeps the settings panel usable', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ ok: false, message: 'Push backend unavailable' }),
    });
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('default');
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: true,
      permission: 'granted',
      registrationId: 'test-fcm-token',
      registrationType: 'token',
      serviceWorkerScope: 'http://localhost/',
      backendSync: { ok: false, reason: 'not-requested', message: 'Backend sync handled by settings.' },
    });

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    await waitFor(() => expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are off'));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    expect(await screen.findByText('News Pulse alerts are temporarily unavailable on this browser.')).toBeTruthy();
    expect(screen.queryByText('Firebase Cloud Messaging registration failed.')).toBeNull();
    expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('Push backend sync failed', {
      status: 503,
      message: 'Push backend unavailable',
    });
    consoleError.mockRestore();
  });

  test('backend sync failure can be retried by toggling push notifications off then on', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let registerRequests = 0;
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url === '/api/public/push/register') {
        registerRequests += 1;
        if (registerRequests === 1) {
          return {
            ok: false,
            status: 503,
            text: async () => JSON.stringify({ ok: false, message: 'Push backend unavailable' }),
          };
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, message: 'ok' }),
      };
    });
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('default');
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: true,
      permission: 'granted',
      registrationId: 'test-fcm-token',
      registrationType: 'token',
      serviceWorkerScope: 'http://localhost/',
      backendSync: { ok: false, reason: 'not-requested', message: 'Backend sync handled by settings.' },
    });

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    await waitFor(() => expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are off'));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    expect(await screen.findByText('News Pulse alerts are temporarily unavailable on this browser.')).toBeTruthy();
    await waitFor(() => expect((global as any).fetch.mock.calls.filter(([url]: any[]) => url === '/api/public/push/register')).toHaveLength(1));

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    await waitFor(() => expect(registerBrowserForFcm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((global as any).fetch.mock.calls.filter(([url]: any[]) => url === '/api/public/push/register')).toHaveLength(2));
    expect(screen.getByText('Notifications enabled and synced')).toBeTruthy();
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('Push backend sync failed', {
      status: 503,
      message: 'Push backend unavailable',
    });
    consoleError.mockRestore();
  });

  test('Firebase registration failure shows unavailable state without blocked-browser text', async () => {
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('default');
    (registerBrowserForFcm as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'registration-failed',
      permission: 'granted',
      message: 'Firebase Cloud Messaging registration failed.',
      error: Object.assign(new Error('Sender ID mismatch'), { name: 'FirebaseError', code: 'messaging/mismatched-credential' }),
    });

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    await waitFor(() => expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are off'));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Notifications' }));

    expect(await screen.findByText('News Pulse alerts are temporarily unavailable on this browser.')).toBeTruthy();
    expect(screen.getByTestId('push-notifications-master-control').textContent).toContain('Notifications are temporarily unavailable');
    expect(screen.queryByText('Notifications are blocked in your browser settings')).toBeNull();
    expect(screen.queryByText("Notifications are blocked in your browser. Allow notifications in your browser's site settings to receive News Pulse alerts.")).toBeNull();
    expect(screen.getByRole('switch', { name: 'Enable Notifications' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('push-diagnostics')).toBeNull();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  test('development push status refresh shows optional backend diagnostics without exposing identifiers', async () => {
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = 'true';
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(
        url === '/api/public/push/diagnostics'
          ? { ok: true, backendReachable: true, firebaseBackendConfigured: true, messagingAvailable: true }
          : { ok: true, message: 'ok' }
      ),
    }));
    window.localStorage.setItem(
      PUSH_NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        types: { breakingNews: true, topStories: true, newArticleAlerts: true, categoryAlerts: true, allArticles: false },
        categoryAlerts: { selected: [] },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    window.localStorage.setItem(
      PUSH_BACKEND_REGISTRATION_STORAGE_KEY,
      JSON.stringify({ registrationId: 'stored-fid-secret', registrationType: 'fid', updatedAt: '2026-01-01T00:00:00.000Z' })
    );
    (getFirebaseClientConfig as jest.Mock).mockReturnValue({ isConfigured: true, config: {}, vapidKey: 'vapid', missingEnv: [] });
    (isFirebaseMessagingSupported as jest.Mock).mockResolvedValue(true);
    (getCurrentNotificationPermission as jest.Mock).mockReturnValue('granted');

    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Check Push Status' }));

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/diagnostics', expect.objectContaining({ method: 'GET' })));
    await waitFor(() => expect(getPushDiagnosticsText()).toContain('Backend reachableYes'));
    expect(getPushDiagnosticsText()).toContain('Firebase backendConfigured');
    expect(getPushDiagnosticsText()).toContain('Messaging availableYes');
    expect(getPushDiagnosticsText()).not.toContain('stored-fid-secret');
    expect(getPushDiagnosticsText()).not.toContain('vapid');
  });

  test('footer buttons work after scrolling and body scrolling is restored on close', async () => {
    const previousOverflow = 'clip';
    document.body.style.overflow = previousOverflow;
    renderWithProviders();

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Preferences' }));
    expect(document.body.style.overflow).toBe('hidden');

    const scrollArea = screen.getByTestId('cookie-preferences-scroll-area');
    fireEvent.scroll(scrollArea, { target: { scrollTop: 800 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject Non-Essential' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe(previousOverflow);

    const stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME));
    expect(stored?.decision).toBe('rejected');
  });

  test('saved, expired, and version-changed decisions control banner visibility', async () => {
    writeConsentCookie(createConsentRecord('accepted', { preferences: true, analytics: true, advertising: true, embeddedMedia: true }, new Date()));
    const accepted = renderWithProviders();
    await waitFor(() => expect(screen.queryByText('Your privacy choices')).toBeNull());
    accepted.unmount();

    const expired = { ...createConsentRecord('accepted', { preferences: true, analytics: true, advertising: true, embeddedMedia: true }, new Date('2026-01-01T00:00:00.000Z')), expiresAt: '2026-01-02T00:00:00.000Z' };
    document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(JSON.stringify(expired))}; Path=/`;
    renderWithProviders();
    expect(await screen.findByText('Your privacy choices')).toBeTruthy();
  });

  test('footer settings button reopens the modal after a decision', async () => {
    writeConsentCookie(createConsentRecord('rejected', { preferences: false, analytics: false, advertising: false, embeddedMedia: false }, new Date()));
    renderWithProviders(<FooterSettingsProbe />);

    await waitFor(() => expect(screen.queryByText('Your privacy choices')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  test('YouTube iframe is blocked without embedded-media consent and loads after permission', async () => {
    renderWithProviders(
      <div style={{ width: 320, height: 180 }}>
        <EmbeddedMediaConsentGate>
          <iframe title="YouTube video" src="https://www.youtube-nocookie.com/embed/abc" />
        </EmbeddedMediaConsentGate>
      </div>
    );

    expect(await screen.findByTestId('embedded-media-placeholder')).toBeTruthy();
    expect(screen.queryByTitle('YouTube video')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Allow Embedded Media' }));
    expect(await screen.findByTitle('YouTube video')).toBeTruthy();
  });
});