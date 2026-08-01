import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CookieConsentProvider, useCookieConsent } from '../../src/consent/CookieConsentProvider';
import EmbeddedMediaConsentGate from '../../src/consent/EmbeddedMediaConsentGate';
import { COOKIE_CONSENT_NAME, createConsentRecord, parseConsentRecord, readCookieValue, writeConsentCookie } from '../../src/consent/cookieConsent';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';

jest.mock('next/script', () => function MockScript(props: any) {
  const { children, dangerouslySetInnerHTML, ...rest } = props;
  return <script data-testid="next-script" {...rest} dangerouslySetInnerHTML={dangerouslySetInnerHTML}>{children}</script>;
});

function renderWithProviders(children: React.ReactNode = <div />) {
  return render(
    <LanguageProvider initialLang="en">
      <CookieConsentProvider>{children}</CookieConsentProvider>
    </LanguageProvider>
  );
}

function FooterSettingsProbe() {
  const { openPreferences } = useCookieConsent();
  return <button type="button" onClick={openPreferences}>Cookie Settings</button>;
}

describe('CookieConsentProvider', () => {
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
  const originalAdsenseId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

  beforeEach(() => {
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    jest.resetAllMocks();
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123';
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = 'pub-test123';
    window.scrollTo = jest.fn();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    process.env.NEXT_PUBLIC_ADSENSE_PUB_ID = originalAdsenseId;
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

    expect(overlay.className).toContain('overflow-y-auto');
    expect(overlay.className).toContain('overscroll-contain');
    expect(dialog.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog.className).toContain('flex-col');
    expect(dialog.className).toContain('overflow-hidden');
    expect(scrollArea.className).toContain('min-h-0');
    expect(scrollArea.className).toContain('flex-1');
    expect(scrollArea.className).toContain('overflow-y-auto');
    expect(footer.className).toContain('flex-shrink-0');
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