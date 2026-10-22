import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import BusinessPage from '../../pages/business';
import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getMessagesForLang, LanguageProvider } from '../../src/i18n/LanguageProvider';
import type { RouteLocale } from '../../lib/localizedArticleFields';

let mockLocale: RouteLocale = 'en';
const labels = { gu: 'પ્રાયોજિત સામગ્રી', hi: 'प्रायोजित सामग्री', en: 'Sponsored Content' };
const locales = ['gu', 'hi', 'en'] as const;
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

jest.mock('next/router', () => ({
  useRouter: () => ({
    locale: mockLocale, isReady: true, query: {}, pathname: '/business',
    asPath: `${mockLocale === 'en' ? '' : `/${mockLocale}`}/business`,
    replace: jest.fn(),
  }),
}));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ locale, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: string; prefetch?: boolean }) => (
    <a {...props} data-next-locale={locale} data-next-prefetch={prefetch} />
  ),
}));
jest.mock('../../components/NewsPulseCategoryShell', () => ({
  __esModule: true,
  default: ({ topContent, children, afterColumns }: { topContent?: React.ReactNode; children: React.ReactNode; afterColumns?: React.ReactNode }) => (
    <><div data-testid="desk-header">{topContent}</div><main>{children}</main>{afterColumns}</>
  ),
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
}));

function articles(locale: RouteLocale, category = 'business') {
  return [1, 2, 3].map(index => ({
    _id: `${category}-${locale}-${index}`,
    slug: `persisted-${category}-${locale}-${index}`,
    canonicalSlug: `unused-alias-${index}`,
    title: `${getMessagesForLang(locale).categories.business} ${index}`,
    content: `<p>Fixture article ${index}</p>`,
    summary: `Fixture summary ${index}`,
    category, language: locale, status: 'published',
    publishedAt: `2026-10-20T10:0${4 - index}:00.000Z`,
    imageUrl: '/fallback.svg',
  }));
}

function business(locale: RouteLocale, items = articles(locale)) {
  return <LanguageProvider initialLang={locale}>
    <BusinessPage
      messages={{}}
      locale={locale}
      initialItems={items}
      initialPagination={{ page: 1, limit: 30, total: items.length, totalPages: items.length ? 1 : 0, hasMore: false }}
    />
  </LanguageProvider>;
}

beforeEach(() => {
  mockLocale = 'en';
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error('Unexpected request from a seeded Business page'));
  global.fetch = fetchMock;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

describe('Business Pulse Sponsored Content navigation', () => {
  test.each(locales)('%s adds one localized header link without changing the header or articles', async locale => {
    mockLocale = locale;
    const items = articles(locale);
    const originalItems = JSON.stringify(items);
    await act(async () => { render(business(locale, items)); });
    const messages = getMessagesForLang(locale);
    const header = within(screen.getByTestId('desk-header'));
    expect(header.getByRole('heading', { level: 1, name: messages.categoryDesks.business.title })).toBeTruthy();
    expect(header.getByText(messages.categoryDesks.business.description)).toBeTruthy();
    const link = header.getByRole('link', { name: labels[locale] });
    expect(screen.getAllByRole('link', { name: labels[locale] })).toHaveLength(1);
    expect(link.getAttribute('href')).toBe('/sponsored-content');
    expect(link.getAttribute('data-next-locale')).toBe(locale);
    expect(link.getAttribute('data-next-prefetch')).toBe('false');
    expect(link.getAttribute('role')).toBeNull();
    expect(link.getAttribute('aria-current')).toBeNull();
    expect(link.getAttribute('target')).toBeNull();
    expect(link.tabIndex).toBe(0);
    expect(link.className).toContain('focus-visible:ring-2');
    link.focus();
    expect(document.activeElement).toBe(link);
    const articleLinks = screen.getAllByRole('link').map(item => item.getAttribute('href')).filter(href => href?.includes('/news/'));
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect([...new Set(articleLinks)]).toEqual(items.map(item => `${prefix}/news/${item.slug}`));
    expect(JSON.stringify(items)).toBe(originalItems);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(locales)('%s keeps archive navigation available for an empty Business feed', async locale => {
    mockLocale = locale;
    await act(async () => { render(business(locale, [])); });
    expect(screen.getByRole('link', { name: labels[locale] })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['national', 'international', 'science-technology', 'tech-gadgets', 'sports', 'lifestyle', 'glamour'])(
    'does not add the Business-only navigation to %s',
    async category => {
      await act(async () => {
        render(<LanguageProvider initialLang="en">
          <CategoryFeedPage
            title={category}
            categoryKey={category}
            useCategoryShell
            initialItems={articles('en', category)}
            initialLocale="en"
            initialPagination={{ page: 1, limit: category === 'national' ? 20 : 30, total: 3, totalPages: 1, hasMore: false }}
          />
        </LanguageProvider>);
      });
      expect(screen.queryByRole('link', { name: labels.en })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test('updates the existing link and seeded articles on locale changes', async () => {
    const { rerender } = render(business('en'));
    let previousLocale: RouteLocale = 'en';
    for (const locale of ['hi', 'gu', 'en'] as const) {
      mockLocale = locale;
      await act(async () => { rerender(business(locale)); });
      expect(screen.getByRole('link', { name: labels[locale] }).getAttribute('data-next-locale')).toBe(locale);
      expect(screen.queryByRole('link', { name: labels[previousLocale] })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      previousLocale = locale;
    }
  });
});
