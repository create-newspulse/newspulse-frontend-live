import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import HomeTopAdSlot from '../../components/home/HomeTopAdSlot';
import AdSlot, { ResolvedAdSlot } from '../../src/components/ads/AdSlot';
import { usePublicAdSlot, type PublicAd, type UsePublicAdSlotResult } from '../../hooks/usePublicAdSlot';
import { useLanguage } from '../../src/i18n/language';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';

jest.mock('../../hooks/usePublicAdSlot', () => ({ usePublicAdSlot: jest.fn() }));
jest.mock('../../src/i18n/language', () => ({ useLanguage: jest.fn() }));
jest.mock('../../src/consent/CookieConsentProvider', () => ({
  useOptionalCookieConsent: () => ({ categories: { advertising: true } }),
}));

const PREMIUM = 'TOP_HOME_BILLBOARD_970x250';
const STANDARD = 'HOME_728x90';
const CLASS_NAME = 'home-shell mx-auto mt-3';
const empty: UsePublicAdSlotResult = { enabled: true, ad: null, isLoading: false, hasResolved: true };
const disabled: UsePublicAdSlotResult = { ...empty, enabled: false };
const loading: UsePublicAdSlotResult = { ...empty, isLoading: true, hasResolved: false };
const premiumAd: PublicAd = { id: 'premium', imageUrl: '/premium.png', title: 'Premium creative', isClickable: true, targetUrl: '/premium-destination' };
const standardAd: PublicAd = { id: 'standard', imageUrl: '/standard.png', title: 'Standard creative', isClickable: true, targetUrl: '/standard-destination' };
const premium: UsePublicAdSlotResult = { ...empty, ad: premiumAd };
const standard: UsePublicAdSlotResult = { ...empty, ad: standardAd };

function setSlots(top: UsePublicAdSlotResult, banner: UsePublicAdSlotResult) {
  jest.mocked(usePublicAdSlot).mockImplementation(({ slot }) => {
    if (slot === PREMIUM) return top;
    if (slot === STANDARD) return banner;
    throw new Error(`Unexpected slot: ${slot}`);
  });
}

function expectSinglePosition(container: HTMLElement) {
  expect(container.querySelectorAll('[data-ad-slot]').length).toBeLessThanOrEqual(1);
  expect(container.querySelectorAll('img').length).toBeLessThanOrEqual(1);
  expect(container.querySelectorAll('.animate-pulse').length).toBeLessThanOrEqual(1);
}

beforeEach(() => {
  jest.mocked(usePublicAdSlot).mockReset();
  jest.mocked(useLanguage).mockReturnValue({ language: 'en', t: (key) => key, setLanguage: jest.fn() });
  setSlots(disabled, disabled);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('shared top-home selection', () => {
  test.each([
    { name: 'premium eligible', top: premium, banner: disabled, image: premiumAd.imageUrl, slot: PREMIUM },
    { name: 'premium absent', top: empty, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'premium enabled without creative', top: empty, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'premium house placeholder cannot beat standard', top: empty, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'both eligible', top: premium, banner: standard, image: premiumAd.imageUrl, slot: PREMIUM },
    { name: 'premium disabled', top: disabled, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'disabled premium ignores stale ad data', top: { ...premium, enabled: false }, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'premium image missing', top: { ...empty, ad: { title: 'Not an image creative' } }, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'premium image blank', top: { ...empty, ad: { imageUrl: '  ' } }, banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'premium disabled and standard house', top: disabled, banner: empty, image: undefined, slot: STANDARD },
    { name: 'neither has inventory', top: empty, banner: empty, image: undefined, slot: STANDARD },
    { name: 'premium empty and standard disabled', top: empty, banner: disabled, image: undefined, slot: null },
    { name: 'both disabled', top: disabled, banner: disabled, image: undefined, slot: null },
  ])('$name', ({ top, banner, image, slot }) => {
    setSlots(top, banner);
    const { container } = render(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(container.querySelector('[data-ad-slot]')?.getAttribute('data-ad-slot') ?? null).toBe(slot);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(image);
    expect(container.querySelector(`a[href="/advertise?slot=${PREMIUM}"]`)).toBeNull();
    if (slot === STANDARD && !image) {
      expect(container.querySelector(`a[href="/advertise?slot=${STANDARD}"]`)).not.toBeNull();
    }
  });

  test('holds one standard-sized skeleton while premium is unresolved, then shows the winner', () => {
    setSlots(loading, standard);
    const { container, rerender } = render(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio).toBe('728 / 90');

    setSlots(premium, standard);
    rerender(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(screen.getByRole('img').getAttribute('src')).toBe(premiumAd.imageUrl);
    expect(container.querySelector('.animate-pulse')).toBeNull();

    setSlots(empty, standard);
    rerender(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(screen.getByRole('img').getAttribute('src')).toBe(standardAd.imageUrl);
  });

  test('renders resolved premium without waiting for standard', () => {
    setSlots(premium, loading);
    const { container } = render(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(screen.getByRole('img').getAttribute('src')).toBe(premiumAd.imageUrl);
  });

  test('keeps one skeleton while both load or while standard loads after an empty premium', () => {
    setSlots(loading, loading);
    const { container, rerender } = render(<HomeTopAdSlot />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    setSlots(empty, loading);
    rerender(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    setSlots(empty, standard);
    rerender(<HomeTopAdSlot />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(standardAd.imageUrl);
  });

  test('refreshes swap the selected creative without mounting both, and disabling removes it', () => {
    setSlots(empty, standard);
    const { container, rerender } = render(<HomeTopAdSlot />);
    for (const [top, banner, src] of [
      [premium, standard, premiumAd.imageUrl],
      [empty, standard, standardAd.imageUrl],
      [disabled, disabled, undefined],
    ] as const) {
      setSlots(top, banner);
      rerender(<HomeTopAdSlot />);
      expectSinglePosition(container);
      expect(container.querySelector('img')?.getAttribute('src')).toBe(src);
    }
  });
});

describe('shared top-home image failures', () => {
  test.each([
    { name: 'standard creative', banner: standard, image: standardAd.imageUrl, slot: STANDARD },
    { name: 'standard house fallback', banner: empty, image: undefined, slot: STANDARD },
    { name: 'nothing when standard disabled', banner: disabled, image: undefined, slot: null },
  ])('premium failure falls back to $name', ({ banner, image, slot }) => {
    setSlots(premium, banner);
    const { container, rerender } = render(<HomeTopAdSlot />);
    fireEvent.error(screen.getByRole('img'));
    expectSinglePosition(container);
    expect(container.querySelector('[data-ad-slot]')?.getAttribute('data-ad-slot') ?? null).toBe(slot);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(image);
    expect(container.querySelector(`a[href="/advertise?slot=${PREMIUM}"]`)).toBeNull();
    if (slot && !image) expect(container.querySelector(`a[href="/advertise?slot=${STANDARD}"]`)).not.toBeNull();
    rerender(<HomeTopAdSlot />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(image);
  });

  test('waits for standard after a failed premium and preserves standard image-error fallback', () => {
    setSlots(premium, loading);
    const { container, rerender } = render(<HomeTopAdSlot />);
    fireEvent.error(screen.getByRole('img'));
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    setSlots(premium, standard);
    rerender(<HomeTopAdSlot />);
    fireEvent.error(screen.getByRole('img'));
    expectSinglePosition(container);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector(`a[href="/advertise?slot=${STANDARD}"]`)).not.toBeNull();
  });

  test('allows a replacement premium image without retrying the failed image on rerenders', () => {
    setSlots(premium, standard);
    const { container, rerender } = render(<HomeTopAdSlot />);
    fireEvent.error(screen.getByRole('img'));
    setSlots({ ...premium, ad: { ...premiumAd } }, standard);
    rerender(<HomeTopAdSlot />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(standardAd.imageUrl);
    setSlots({ ...premium, ad: { ...premiumAd, imageUrl: '/replacement.png' } }, standard);
    rerender(<HomeTopAdSlot />);
    expectSinglePosition(container);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/replacement.png');
  });

  test('resets candidate state on language changes', () => {
    setSlots(premium, standard);
    const { rerender } = render(<HomeTopAdSlot />);
    fireEvent.error(screen.getByRole('img'));
    jest.mocked(useLanguage).mockReturnValue({ language: 'hi', t: (key) => key, setLanguage: jest.fn() });
    rerender(<HomeTopAdSlot />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(premiumAd.imageUrl);
    expect(usePublicAdSlot).toHaveBeenCalledWith({ slot: PREMIUM, language: 'hi' });
    expect(usePublicAdSlot).toHaveBeenCalledWith({ slot: STANDARD, language: 'hi' });
  });
});

describe('shared ad presentation compatibility', () => {
  test.each([true, false])('preserves standard rendering exactly when isClickable=%s', (isClickable) => {
    setSlots(empty, { ...standard, ad: { ...standardAd, isClickable } });
    const shared = renderToString(<HomeTopAdSlot />);
    const previous = renderToString(<AdSlot slot={STANDARD} variant="homeBanner" className={CLASS_NAME} />);
    expect(shared).toBe(previous);
  });

  test.each([empty, loading, disabled])('preserves standard house/loading/disabled markup: %j', (state) => {
    setSlots(empty, state);
    expect(renderToString(<HomeTopAdSlot />)).toBe(
      renderToString(<AdSlot slot={STANDARD} variant="homeBanner" className={CLASS_NAME} />)
    );
  });

  test.each([
    { isClickable: true, targetUrl: '/premium-destination', linked: true },
    { isClickable: false, targetUrl: '/premium-destination', linked: false },
    { isClickable: true, targetUrl: '', linked: false },
  ])('preserves premium click behavior: %j', ({ isClickable, targetUrl, linked }) => {
    setSlots({ ...premium, ad: { ...premiumAd, isClickable, targetUrl } }, standard);
    const { container } = render(<HomeTopAdSlot />);
    const image = screen.getByRole('img');
    const link = image.closest('a');
    expect(Boolean(link)).toBe(linked);
    if (linked) {
      expect(link?.getAttribute('href')).toBe(targetUrl);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('nofollow sponsored noopener noreferrer');
    }
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('decoding')).toBe('async');
    expect(container.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio).toBe('970 / 250');
    expect((image as HTMLImageElement).style.objectFit).toBe('cover');
    expect((image as HTMLImageElement).style.objectPosition).toBe('center');
    expect(container.querySelector('[data-ad-slot]')?.className).toBe('mx-auto w-full max-w-[970px] xl:max-w-[1200px]');
    expect(container.querySelector('[data-ad-slot]')?.parentElement?.className).toBe(`${CLASS_NAME} not-prose`);
  });

  test('premium reuses the independent billboard frame without changing its markup', () => {
    const props = { variant: 'billboard970x250' as const, className: 'mx-auto w-full', state: premium };
    const topHtml = renderToString(<ResolvedAdSlot slot={PREMIUM} {...props} />);
    const existingHtml = renderToString(<ResolvedAdSlot slot="HOME_BILLBOARD_970x250" {...props} />);
    expect(topHtml.replace(PREMIUM, 'HOME_BILLBOARD_970x250')).toBe(existingHtml);
  });

  test.each(['en', 'hi', 'gu'] as const)('category billboard retains the selected full creative and slot dimensions for %s', (language) => {
    const slot = 'HOME_BILLBOARD_970x250';
    const ad = { ...premiumAd, thumbnailUrl: '/admin-thumbnail.png', width: 97, height: 25 };
    jest.mocked(useLanguage).mockReturnValue({ language, t: (key) => key, setLanguage: jest.fn() });
    jest.mocked(usePublicAdSlot).mockReturnValue({ ...premium, ad });
    const { container } = render(<AdSlot slot={slot} variant="billboard970x250" className="mx-auto w-full" />);
    const image = screen.getByRole('img');
    const link = image.closest('a');
    expect(usePublicAdSlot).toHaveBeenCalledWith({ slot, language });
    expect(image.getAttribute('src')).toBe(premiumAd.imageUrl);
    expect(image.getAttribute('src')).not.toBe(ad.thumbnailUrl);
    expect(image.getAttribute('width')).toBeNull();
    expect(image.getAttribute('height')).toBeNull();
    expect((image as HTMLImageElement).style.objectFit).toBe('cover');
    expect(container.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio).toBe('970 / 250');
    expect(container.querySelector('[data-ad-slot]')?.className).toBe('mx-auto w-full max-w-[970px] xl:max-w-[1200px]');
    expect(container.querySelector('[data-ad-slot]')?.parentElement?.className).toBe('mx-auto w-full not-prose');
    expect(link?.getAttribute('href')).toBe(premiumAd.targetUrl);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('nofollow sponsored noopener noreferrer');
    expect(container.querySelector(`a[href="/advertise?slot=${slot}"]`)).toBeNull();
  });

  test.each([
    { name: 'assigned creative', state: premium, creative: true, fallback: false },
    { name: 'empty eligible inventory', state: empty, creative: false, fallback: true },
    { name: 'disabled inventory', state: disabled, creative: false, fallback: false },
    { name: 'unresolved inventory', state: loading, creative: false, fallback: false },
  ])('independent billboard preserves $name behavior', ({ state, creative, fallback }) => {
    const slot = 'HOME_BILLBOARD_970x250';
    const { container } = render(<ResolvedAdSlot slot={slot} variant="billboard970x250" className="mx-auto w-full" state={state} />);
    expect(Boolean(container.querySelector('img'))).toBe(creative);
    expect(Boolean(container.querySelector(`a[href="/advertise?slot=${slot}"]`))).toBe(fallback);
    expect(Boolean(container.querySelector('.animate-pulse'))).toBe(state.isLoading);
    expect(Boolean(container.querySelector('[data-ad-slot]'))).toBe(state.enabled);
  });

  test('resolved rendering never fetches, and Strict Mode does not introduce tracking', () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected fetch from presentation'));
    setSlots(premium, standard);
    const { container, rerender } = render(<React.StrictMode><HomeTopAdSlot /></React.StrictMode>);
    rerender(<React.StrictMode><HomeTopAdSlot /></React.StrictMode>);
    expectSinglePosition(container);
    expect(fetchSpy).not.toHaveBeenCalled();
    jest.mocked(usePublicAdSlot).mockClear();
    renderToString(<ResolvedAdSlot slot={PREMIUM} state={premium} />);
    expect(usePublicAdSlot).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

test('real hook resolves independent requests once in Strict Mode and refreshes only inventory, not impressions', async () => {
  const actualHook = jest.requireActual<typeof import('../../hooks/usePublicAdSlot')>('../../hooks/usePublicAdSlot');
  jest.mocked(usePublicAdSlot).mockImplementation(actualHook.usePublicAdSlot);
  const pending = new Map<string, (response: Response) => void>();
  const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input), 'http://localhost');
    expect(url.pathname).toBe('/api/public/ads');
    expect(url.searchParams.get('lang')).toBe('en');
    return new Promise<Response>((resolve) => pending.set(url.searchParams.get('slot')!, resolve));
  });
  const resolveSlot = async (slot: string, ad: PublicAd | null) => {
    const resolve = pending.get(slot);
    expect(resolve).toBeDefined();
    pending.delete(slot);
    await act(async () => {
      resolve!(new Response(JSON.stringify({ enabled: true, ad }), { status: 200 }));
    });
  };

  const { container, unmount } = render(<React.StrictMode><HomeTopAdSlot /></React.StrictMode>);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  await resolveSlot(STANDARD, standardAd);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
  await resolveSlot(PREMIUM, premiumAd);
  expectSinglePosition(container);
  expect(screen.getByRole('img').getAttribute('src')).toBe(premiumAd.imageUrl);
  act(() => dispatchPublicDataRefresh({ version: 'top-home-test', previousVersion: null, source: 'test' }));
  expect(fetchSpy).toHaveBeenCalledTimes(4);
  await resolveSlot(STANDARD, standardAd);
  expect(screen.getByRole('img').getAttribute('src')).toBe(premiumAd.imageUrl);
  await resolveSlot(PREMIUM, null);
  expectSinglePosition(container);
  expect(screen.getByRole('img').getAttribute('src')).toBe(standardAd.imageUrl);
  expect(fetchSpy).toHaveBeenCalledTimes(4);
  unmount();
  act(() => dispatchPublicDataRefresh({ version: 'after-unmount', previousVersion: 'top-home-test', source: 'test' }));
  expect(fetchSpy).toHaveBeenCalledTimes(4);
});
