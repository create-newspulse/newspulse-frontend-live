import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import AdSlot, { ResolvedAdSlot } from '../../src/components/ads/AdSlot';
import { CookieConsentProvider, useCookieConsent } from '../../src/consent/CookieConsentProvider';
import { createConsentRecord, deleteConsentCookie, writeConsentCookie } from '../../src/consent/cookieConsent';
import { LanguageProvider, type Lang } from '../../src/i18n/LanguageProvider';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { type PublicAd } from '../../hooks/usePublicAdSlot';

jest.mock('next/script', () => ({ __esModule: true, default: () => null }));
jest.mock('../../lib/firebaseClient', () => ({ getFirebaseClientConfig: jest.fn() }));
jest.mock('../../lib/firebaseMessaging', () => ({
  getCurrentNotificationPermission: jest.fn(),
  isFirebaseMessagingSupported: jest.fn(),
  registerBrowserForFcm: jest.fn(),
}));

const rightSlots = ['HOME_RIGHT_300x250', 'HOME_RIGHT_300x600'] as const;
const paidAd: PublicAd = {
  id: 'consent-test-creative',
  title: 'Paid test creative',
  imageUrl: '/consent-test-creative.png',
  targetUrl: '/consent-test-destination',
  isClickable: true,
};
const emptyState = { enabled: true, ad: null, isLoading: false, hasResolved: true };
const envKeys = ['NEXT_PUBLIC_BACKEND_URL', 'NEXT_PUBLIC_GA_ID', 'NEXT_PUBLIC_ADSENSE_PUB_ID'] as const;
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let clock = Date.now();
let inventory: { enabled: boolean; ad: PublicAd | null };
let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;

function ConsentControls() {
  const { savePreferences, rejectNonEssential } = useCookieConsent();
  return (
    <>
      <button onClick={() => savePreferences({ advertising: true })}>Grant test advertising</button>
      <button onClick={rejectNonEssential}>Deny test advertising</button>
    </>
  );
}

function TestApp({ lang = 'en', children }: { lang?: Lang; children?: React.ReactNode }) {
  return (
    <LanguageProvider initialLang={lang}>
      <CookieConsentProvider>
        <div data-testid="house-slots">
          {children ?? rightSlots.map(slot => <AdSlot key={slot} slot={slot} showHousePlaceholderWithoutConsent />)}
        </div>
        <ConsentControls />
      </CookieConsentProvider>
    </LanguageProvider>
  );
}

function grantAdvertising() {
  fireEvent.click(screen.getByRole('button', { name: 'Grant test advertising' }));
}

function denyAdvertising() {
  fireEvent.click(screen.getByRole('button', { name: 'Deny test advertising' }));
}

function refreshAds() {
  dispatchPublicDataRefresh({ version: 'house-consent-test', previousVersion: null, source: 'test' });
}

function expectHouseSlots(element: ParentNode) {
  for (const slot of rightSlots) {
    expect(element.querySelector(`a[href="/advertise?slot=${slot}"]`)).not.toBeNull();
  }
  expect(element.querySelector('img')).toBeNull();
  expect(element.querySelector('iframe, script')).toBeNull();
  expect(element.querySelector(`a[href="${paidAd.targetUrl}"]`)).toBeNull();
}

beforeEach(() => {
  clock += 60_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  deleteConsentCookie();
  window.scrollTo = jest.fn();
  for (const key of envKeys) process.env[key] = '';
  inventory = { enabled: true, ad: null };
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    expect(url.origin).toBe('http://localhost');
    expect(url.pathname).toBe('/api/public/ads');
    expect(init?.method).toBe('GET');
    return new Response(JSON.stringify({ ok: true, ...inventory }), { status: 200 });
  });
});

afterEach(() => {
  cleanup();
  deleteConsentCookie();
  jest.restoreAllMocks();
});

afterAll(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe.each(['en', 'hi', 'gu'] as const)('right house placeholders (%s)', lang => {
  test.each(['unset', 'denied', 'granted'] as const)('%s consent preserves legacy house markup through SSR and hydration', async decision => {
    if (decision === 'denied') writeConsentCookie(createConsentRecord('rejected', {}));
    if (decision === 'granted') writeConsentCookie(createConsentRecord('custom', { advertising: true }));
    const app = <TestApp lang={lang} />;
    const html = renderToString(app);
    const legacy = renderToString(
      <LanguageProvider initialLang={lang}>
        <div data-testid="house-slots">
          {rightSlots.map(slot => <ResolvedAdSlot key={slot} slot={slot} state={emptyState} />)}
        </div>
      </LanguageProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const slots = container.querySelector('[data-testid="house-slots"]')!;
    const before = slots.innerHTML;
    const legacySlots = new DOMParser().parseFromString(legacy, 'text/html').querySelector('[data-testid="house-slots"]')!;
    expect(before).toBe(legacySlots.innerHTML);
    expectHouseSlots(slots);
    expect(slots.textContent).toContain('300\u00d7250');
    expect(slots.textContent).toContain('300\u00d7600');
    expect(fetchSpy).not.toHaveBeenCalled();

    const removedLinks: Element[] = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of Array.from(record.removedNodes)) {
          if (node instanceof Element && (node.matches('a') || node.querySelector('a'))) removedLinks.push(node);
        }
      }
    });
    observer.observe(slots, { childList: true, subtree: true });
    const recoverableErrors = jest.fn();
    let root: Root | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, app, { onRecoverableError: recoverableErrors }); });
      expect(slots.innerHTML).toBe(before);
      expectHouseSlots(slots);
      expect(recoverableErrors).not.toHaveBeenCalled();
      expect(removedLinks).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(decision === 'granted' ? 2 : 0);
      for (const [input] of fetchSpy.mock.calls) {
        expect(new URL(String(input), 'http://localhost').searchParams.get('lang')).toBe(lang);
      }
      if (decision !== 'granted') {
        await act(async () => refreshAds());
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    } finally {
      observer.disconnect();
      if (root) await act(async () => root!.unmount());
      container.remove();
    }
  });

  test('paid inventory requires consent, and withdrawal/remount never exposes cached creatives', async () => {
    inventory = { enabled: true, ad: paidAd };
    const { unmount } = render(<TestApp lang={lang} />);
    expectHouseSlots(screen.getByTestId('house-slots'));
    expect(fetchSpy).not.toHaveBeenCalled();

    grantAdvertising();
    await waitFor(() => expect(screen.getByTestId('house-slots').querySelectorAll('img')).toHaveLength(2));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('house-slots').querySelector('img')?.getAttribute('src')).toBe(paidAd.imageUrl);

    denyAdvertising();
    expectHouseSlots(screen.getByTestId('house-slots'));
    await act(async () => refreshAds());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    unmount();

    const html = renderToString(<TestApp lang={lang} />);
    expect(html).not.toContain(paidAd.imageUrl);
    expect(html).not.toContain(paidAd.targetUrl);
    const remounted = render(<TestApp lang={lang} />);
    expectHouseSlots(screen.getByTestId('house-slots'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    remounted.unmount();
  });
});

test('other placements and non-opted-in category right rails remain consent-hidden', () => {
  const otherSlots = [...rightSlots, 'HOME_LEFT_300x250', 'HOME_LEFT_300x600', 'HOME_728x90', 'HOME_BILLBOARD_970x250', 'FOOTER_BANNER_728x90', 'ARTICLE_INLINE'];
  render(<TestApp>{otherSlots.map(slot => <AdSlot key={slot} slot={slot} />)}</TestApp>);
  expect(screen.getByTestId('house-slots').childElementCount).toBe(0);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('a consent-blocked resolved slot cannot display a supplied paid creative', () => {
  render(
    <TestApp>
      {rightSlots.map(slot => (
        <ResolvedAdSlot key={slot} slot={slot} state={{ ...emptyState, ad: paidAd, blockedReason: 'consent' }} showHousePlaceholderWithoutConsent />
      ))}
    </TestApp>
  );
  expectHouseSlots(screen.getByTestId('house-slots'));
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('late paid responses after withdrawal never render, and Strict Mode deduplicates reads', async () => {
  const pending: Array<(response: Response) => void> = [];
  fetchSpy.mockImplementation(() => new Promise<Response>(resolve => pending.push(resolve)));
  render(<React.StrictMode><TestApp /></React.StrictMode>);
  grantAdvertising();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  denyAdvertising();
  await act(async () => {
    pending.forEach(resolve => resolve(new Response(JSON.stringify({ enabled: true, ad: paidAd }))));
  });
  expectHouseSlots(screen.getByTestId('house-slots'));
  await act(async () => refreshAds());
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test('withdrawal prevents a new proxy fallback request after a previously permitted backend read fails', async () => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://127.0.0.1:9';
  let rejectRead!: (reason: Error) => void;
  fetchSpy.mockImplementation(() => new Promise<Response>((_resolve, reject) => { rejectRead = reject; }));
  render(<TestApp><AdSlot slot={rightSlots[0]} showHousePlaceholderWithoutConsent /></TestApp>);
  grantAdvertising();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  denyAdvertising();
  await act(async () => rejectRead(new Error('Local mock backend read failed')));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('house-slots').querySelector('img')).toBeNull();
  expect(screen.getByTestId('house-slots').querySelector('a')).not.toBeNull();
});

test('a new permitted subscriber recovers from a withdrawn shared request', async () => {
  let rejectRead!: (reason: Error) => void;
  fetchSpy.mockImplementationOnce(() => new Promise<Response>((_resolve, reject) => { rejectRead = reject; }));
  const app = <TestApp><AdSlot slot={rightSlots[0]} showHousePlaceholderWithoutConsent /></TestApp>;
  const first = render(app);
  grantAdvertising();
  denyAdvertising();
  first.unmount();
  writeConsentCookie(createConsentRecord('custom', { advertising: true }));
  render(app);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  await act(async () => rejectRead(new Error('Withdrawn mock read failed')));
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('house-slots').querySelector('a')).not.toBeNull();
});

test.each(['en', 'hi', 'gu'] as const)('known Admin-off remains hidden without consent after cache expiry (%s)', async lang => {
  inventory = { enabled: false, ad: paidAd };
  writeConsentCookie(createConsentRecord('custom', { advertising: true }));
  render(<TestApp lang={lang} />);
  await waitFor(() => expect(screen.getByTestId('house-slots').childElementCount).toBe(0));
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  try {
    clock += 20_000;
    denyAdvertising();
    expect(screen.getByTestId('house-slots').childElementCount).toBe(0);
    await act(async () => refreshAds());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const html = renderToString(<TestApp lang={lang} />);
    expect(html).not.toContain(`/advertise?slot=${rightSlots[0]}`);
    expect(html).not.toContain(`/advertise?slot=${rightSlots[1]}`);
  } finally {
    inventory = { enabled: true, ad: null };
    grantAdvertising();
    await act(async () => refreshAds());
    await waitFor(() => expectHouseSlots(screen.getByTestId('house-slots')));
  }
});
