import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import MyApp from '../../pages/_app';
import TopicPage, { type TopicPageProps } from '../../pages/topic/[slug]';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { editorialTopicPath } from '../../lib/publicEditorialTopics';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { getMessagesForLang } from '../../src/i18n/LanguageProvider';
import { storyFixture, topicFixture } from '../fixtures/editorialTopics';

const mockRouter = {
  isReady: true, locale: 'en', defaultLocale: 'en', pathname: '/topic/[slug]',
  asPath: '/topic/navratri-2026?page=2#stories', query: { slug: 'navratri-2026', page: '2' },
  replace: jest.fn(async () => true), push: jest.fn(async () => true), back: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
};

jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ locale, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: false }) => <a {...props}>{children}</a>,
}));
jest.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'font-inter' }),
  Noto_Sans_Gujarati: () => ({ variable: 'font-gujarati' }),
  Noto_Sans_Devanagari: () => ({ variable: 'font-devanagari' }),
}));
jest.mock('../../styles/globals.css', () => ({}));
jest.mock('@vercel/analytics/next', () => ({ Analytics: () => null }));
jest.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => null }));
jest.mock('../../lib/gtag', () => ({ pageview: jest.fn() }));
jest.mock('../../hooks/usePublicVersion', () => ({ usePublicVersion: jest.fn() }));
jest.mock('../../components/FirebaseForegroundMessaging', () => ({ __esModule: true, default: () => null }));
jest.mock('../../hooks/useReporterPortalSession', () => ({
  ReporterAuthProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../../src/context/PublicSettingsContext', () => ({
  PublicSettingsProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  usePublicSettings: () => ({ settings: null, error: null }),
}));
jest.mock('../../utils/PublicModeProvider', () => ({
  PublicModeProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../../utils/FeatureFlagProvider', () => ({
  FeatureFlagProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../../src/consent/CookieConsentProvider', () => ({
  CookieConsentProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../../lib/SafeIntlProvider', () => ({
  __esModule: true, default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({
    toggles: jest.requireActual('../../lib/publicFounderToggles').DEFAULT_PUBLIC_FOUNDER_TOGGLES,
  }),
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true, default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const originalMatchMedia = window.matchMedia;

function propsFor(lang: RouteLocale): TopicPageProps {
  const story = storyFixture(1, lang);
  return {
    mode: 'editorial', locale: lang, messages: {}, topic: topicFixture(lang), pinnedArticle: null,
    items: [{
      id: story._id, title: story.title, titleText: story.title, summary: story.summary,
      href: buildNewsUrl({ id: story._id, slug: story.slug, lang }),
      category: story.category, translationKey: story.translationKey, translationGroupId: story.translationGroupId,
    }],
    pagination: { page: 2, totalPages: 3, hasNextPage: true },
    seo: { title: 'Navratri 2026', description: '', canonicalUrl: `https://www.newspulse.co.in${editorialTopicPath('navratri-2026', lang, 2)}`, alternates: [], jsonLd: {} },
  };
}

function mount(lang: RouteLocale = 'en') {
  mockRouter.locale = lang;
  mockRouter.asPath = `${editorialTopicPath('navratri-2026', lang, 2)}#stories`;
  return render(<MyApp Component={TopicPage} pageProps={propsFor(lang)} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: jest.fn((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
    })),
  });
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  document.documentElement.classList.remove('dark');
});

test.each(['en', 'hi', 'gu'] as const)('%s topic archive has one shared header above unchanged article cards', (lang) => {
  const { container } = mount(lang);
  const headers = container.querySelectorAll('[data-news-pulse-top-header="true"]');
  expect(headers).toHaveLength(1);
  const header = headers[0] as HTMLElement;
  const title = screen.getByRole('heading', { level: 1 });
  expect(header.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(header).getByRole('link', { name: 'News Pulse home' }).getAttribute('href')).toBe('/');
  expect(within(header).getByRole('button', { name: 'Menu' })).toBeTruthy();
  expect(within(header).getByRole('button', { name: 'Language' }).textContent).toContain({ en: 'English', hi: 'Hindi', gu: 'Gujarati' }[lang]);
  expect(within(header).getByRole('button', { name: 'Style' }).textContent).toContain('Aurora');
  expect(container.querySelectorAll('article')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: storyFixture(1, lang).title }).closest('a')?.getAttribute('href')).toBe(
    `${lang === 'en' ? '' : `/${lang}`}/news/story-1`,
  );
  expect(screen.getByRole('link', { name: getMessagesForLang(lang).topicPage.next }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', lang, 3));
});

test('the existing menu opens with its ordinary navigation links', () => {
  const { container } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const shortcuts = container.querySelector('[data-shared-drawer-shortcuts="true"]');
  expect(shortcuts).not.toBeNull();
  expect(shortcuts?.querySelector('a[href="/"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-news-pulse-top-header="true"]')).toHaveLength(1);
});

test.each([['en', 'English'], ['hi', 'Hindi'], ['gu', 'Gujarati']] as const)('shared language control selects %s without losing the topic page/query', (lang, label) => {
  mount(lang === 'gu' ? 'en' : 'gu');
  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByRole('button', { name: label }));
  const next = `${editorialTopicPath('navratri-2026', lang, 2)}#stories`;
  expect(mockRouter.replace).toHaveBeenCalledWith(next, next, { locale: lang, shallow: false, scroll: false });
});

test('the existing Aurora/Midnight style control works without changing cards or adding another header', () => {
  const { container } = mount();
  const articleLink = () => screen.getByRole('heading', { name: storyFixture(1).title }).closest('a')?.getAttribute('href');
  const before = articleLink();
  fireEvent.click(screen.getByRole('button', { name: 'Style' }));
  fireEvent.click(screen.getByRole('button', { name: 'Midnight' }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(screen.getByRole('button', { name: 'Style' }).textContent).toContain('Midnight');
  fireEvent.click(screen.getByRole('button', { name: 'Style' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aurora' }));
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(articleLink()).toBe(before);
  expect(container.querySelectorAll('[data-news-pulse-top-header="true"]')).toHaveLength(1);
});

test.each([
  ['/', 0], ['/news/existing-story', 0], ['/business', 1],
  ['/gu/regional/gujarat', 1], ['/topic-other', 0], ['/reporter/login', 0],
])('leaves shared-header ownership unchanged on %s', (asPath, count) => {
  mockRouter.asPath = String(asPath);
  mockRouter.locale = 'en';
  const { container } = render(<MyApp Component={() => <main>Existing page</main>} pageProps={{}} />);
  expect(container.querySelectorAll('[data-news-pulse-top-header="true"]')).toHaveLength(count);
});
