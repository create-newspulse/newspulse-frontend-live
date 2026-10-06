import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useRouter, type NextRouter } from 'next/router';

import SharedMobileNavigationDrawer from '../../src/components/layout/SharedMobileNavigationDrawer';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';
import { DEFAULT_PUBLIC_FOUNDER_TOGGLES } from '../../lib/publicFounderToggles';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, onClick, ...props }: React.ComponentProps<'a'>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

const router: NextRouter = {
  route: '/',
  pathname: '/',
  query: {},
  asPath: '/',
  basePath: '',
  locale: 'en',
  locales: ['en', 'hi', 'gu'],
  defaultLocale: 'en',
  isLocaleDomain: false,
  isFallback: false,
  isReady: true,
  isPreview: false,
  push: jest.fn().mockResolvedValue(true),
  replace: jest.fn().mockResolvedValue(true),
  reload: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
  beforePopState: jest.fn(),
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
};

const theme = { surface: '#fff', surface2: '#eee', border: '#ddd', text: '#111', sub: '#555' };
const cases = [
  {
    lang: 'en',
    path: '/',
    heading: 'Quick Access',
    labels: ['Latest News', 'Breaking News', 'Live Updates', 'Top Stories', 'Advertise With Us'],
    topActions: ['Home', 'Videos', 'Search'],
  },
  {
    lang: 'hi',
    path: '/hi',
    heading: 'त्वरित पहुँच',
    labels: ['नवीनतम समाचार', 'ब्रेकिंग न्यूज़', 'लाइव अपडेट्स', 'प्रमुख खबरें', 'हमारे साथ विज्ञापन'],
    topActions: ['होम', 'वीडियो', 'खोजें'],
  },
  {
    lang: 'gu',
    path: '/gu',
    heading: 'ઝડપી ઍક્સેસ',
    labels: ['તાજા સમાચાર', 'બ્રેકિંગ ન્યૂઝ', 'લાઇવ અપડેટ્સ', 'મુખ્ય સમાચાર', 'અમારી સાથે જાહેરાત'],
    topActions: ['હોમ', 'વીડિયોઝ', 'શોધ'],
  },
] as const;

describe.each(cases)('mobile drawer on $path', ({ lang, path, heading, labels, topActions }) => {
  const onClose = jest.fn();
  const prefix = lang === 'en' ? '' : `/${lang}`;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    document.body.style.overflow = '';
    router.asPath = path;
    router.locale = lang;
    jest.mocked(useRouter).mockReturnValue(router);
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  function drawer(open = true) {
    return (
      <LanguageProvider initialLang={lang}>
        <SharedMobileNavigationDrawer
          open={open}
          onClose={onClose}
          theme={theme}
          lang={lang}
          activeCategoryKey="regional"
          founderToggles={{ ...DEFAULT_PUBLIC_FOUNDER_TOGGLES, viralVideosFrontendEnabled: true }}
        />
      </LanguageProvider>
    );
  }

  test('uses exact Quick Access translations and preserves order, routes, icons and link closing', () => {
    render(drawer());
    const headingElement = screen.getByText(heading);
    const section = headingElement.parentElement;
    if (!section) throw new Error('Quick Access section is missing');
    const links = within(section).getAllByRole('link');

    expect(headingElement.classList.contains('uppercase')).toBe(true);
    expect(links.map((link) => link.textContent)).toEqual(labels);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `${prefix}/latest`,
      `${prefix}/breaking?tab=breaking`,
      `${prefix}/breaking?tab=live`,
      `${path}#top-story`,
      `${prefix}/advertise-with-us`,
    ]);

    const icons = ['bell', 'flame', 'radio', 'flag', 'briefcase'];
    links.forEach((link, index) => {
      expect(link.querySelector(`svg.lucide-${icons[index]}`)).not.toBeNull();
      expect(link.querySelector('svg.lucide-chevron-right')).not.toBeNull();
      fireEvent.click(link);
      expect(onClose).toHaveBeenCalledTimes(index + 1);
    });

    if (lang !== 'en') expect(section.textContent).not.toMatch(/[A-Za-z]/);
  });

  test('preserves Home/Videos/Search, active category and language-switcher behavior', () => {
    const { container } = render(drawer());
    const shortcuts = container.querySelector<HTMLElement>('[data-shared-drawer-shortcuts="true"]');
    if (!shortcuts) throw new Error('Drawer shortcuts are missing');
    const links = within(shortcuts).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(topActions);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      path,
      `${prefix}/viral-videos`,
      `${prefix}/search`,
    ]);
    expect(links[0].classList.contains('ring-2')).toBe(true);
    expect(container.querySelector('[data-drawer-category-key="regional"]')?.getAttribute('data-active')).toBe('true');

    for (const [label, target, locale] of [
      ['English', '/', 'en'],
      ['Hindi', '/hi', 'hi'],
      ['Gujarati', '/gu', 'gu'],
    ] as const) {
      const link = screen.getByRole('link', { name: label });
      expect(link.getAttribute('href')).toBe(target);
      fireEvent.click(link);
      expect(router.replace).toHaveBeenLastCalledWith(target, target, { locale, shallow: false, scroll: false });
    }
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('preserves closed state, close button, route-change closing and scroll restoration', () => {
    const { container, rerender, unmount } = render(drawer(false));
    expect(container.textContent).toBe('');
    document.body.style.overflow = 'auto';

    rerender(drawer());
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const subscription = jest.mocked(router.events.on).mock.calls.find(([event]) => event === 'routeChangeStart');
    if (!subscription) throw new Error('Drawer route-change subscription is missing');
    subscription[1]('/latest');
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(router.events.off).toHaveBeenCalledWith('routeChangeStart', subscription[1]);
  });
});
