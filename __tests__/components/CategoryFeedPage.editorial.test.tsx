import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { fetchPublicNews } from '../../lib/publicNewsApi';

let mockLanguage = 'en';

jest.mock('../../lib/publicNewsApi', () => ({
  fetchPublicNews: jest.fn(),
}));

jest.mock('../../utils/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
}));

jest.mock('../../src/i18n/LanguageProvider', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'brand.name': 'News Pulse',
      'categories.editorial': 'Editorial',
      'categoryPage.noStoriesYet': 'No stories yet.',
      'categoryPage.untitled': 'Untitled',
      'categoryPage.articleImageAlt': 'Article image',
      'categoryPage.unableToLoadTitle': 'Unable to load stories',
      'categoryPage.publicFeedProtected': 'Public feed is protected.',
      'categoryPage.ensureBackendRunning': 'Ensure backend is running.',
      'errors.fetchFailed': 'Fetch failed',
    } as Record<string, string>)[key] || key,
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
  }),
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function mockArticle(overrides: Record<string, any>) {
  return {
    _id: overrides._id || overrides.slug || 'article-1',
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    category: 'editorial',
    language: 'en',
    title: 'Why Responsible Journalism Matters',
    summary: 'A public note on journalism.',
    content: '<p>Body</p>',
    slug: 'responsible-journalism',
    ...overrides,
  };
}

function renderEditorialPage(items: any[]) {
  (fetchPublicNews as jest.Mock).mockResolvedValue({ items, meta: {}, endpoint: '/api/public/news' });
  return render(<CategoryFeedPage title="Editorial" categoryKey="editorial" />);
}

describe('CategoryFeedPage editorial listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  afterEach(() => {
    cleanup();
  });

  test('displays a clean empty editorial state and fetches all published editorial records', async () => {
    renderEditorialPage([]);

    expect(screen.getByRole('heading', { name: 'Editorial' })).toBeTruthy();
    expect(screen.getByText('In-depth Editorials and Special Stories from News Pulse.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search Editorials and Special Stories...')).toBeTruthy();
    expect(await screen.findByText('No stories yet.')).toBeTruthy();
    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({
      category: 'editorial',
      language: 'en',
      limit: 30,
      extraQuery: { strictLocale: '1' },
    }));
  });

  test('renders editorial and special story cards with type, author fields, date, reading time, and detail links', async () => {
    renderEditorialPage([
      mockArticle({
        _id: 'founder-special',
        slug: 'founder-special',
        editorialType: 'special_story',
        title: 'Inside Gujarat Water Situation',
        summary: 'A reported special story.',
        authorName: 'Kiran Parmar',
        authorDesignation: 'Founder, News Pulse',
        readingTime: 5,
      }),
      mockArticle({
        _id: 'editorial-missing-type',
        slug: 'editorial-missing-type',
        title: 'Why Responsible Journalism Matters',
        authorName: 'Authorised Editor',
        authorDesignation: 'Editor, News Pulse',
      }),
    ]);

    expect(await screen.findByText('Inside Gujarat Water Situation')).toBeTruthy();
    expect(screen.getByText('SPECIAL STORY')).toBeTruthy();
    expect(screen.getByText('EDITORIAL')).toBeTruthy();
    expect(screen.queryByText(/Founder.s Voice/i)).toBeNull();
    expect(screen.queryByText(/Opinion|Analysis|Commentary|Explainer/i)).toBeNull();
    expect(screen.getByText('By Kiran Parmar')).toBeTruthy();
    expect(screen.getByText('Founder, News Pulse')).toBeTruthy();
    expect(screen.getByText('By Authorised Editor')).toBeTruthy();
    expect(screen.getByText('Editor, News Pulse')).toBeTruthy();
    expect(screen.getByText('5 min read')).toBeTruthy();
    expect(screen.getAllByText('Read More')).toHaveLength(2);
    expect(screen.queryByLabelText('Article language')).toBeNull();
    expect(screen.queryByText('EN')).toBeNull();
    expect(screen.queryByText('HI')).toBeNull();
    expect(screen.queryByText('GU')).toBeNull();

    const detailLink = screen.getByRole('link', { name: 'Inside Gujarat Water Situation' });
    expect(detailLink.getAttribute('href')).toBe('/news/founder-special');
  });

  test.each([
    ['en', 'English Editorial', '/news/english-editorial'],
    ['hi', 'हिंदी संपादकीय', '/hi/news/hindi-editorial'],
    ['gu', 'ગુજરાતી સંપાદકીય', '/gu/news/gujarati-editorial'],
  ])('renders stored %s editorial content without translating it', async (language, title, expectedHref) => {
    mockLanguage = language;
    renderEditorialPage([
      mockArticle({
        _id: `${language}-article`,
        language,
        title,
        slug: `${language === 'en' ? 'english' : language === 'hi' ? 'hindi' : 'gujarati'}-editorial`,
        authorName: 'Public Author',
        authorDesignation: 'Desk, News Pulse',
      }),
    ]);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByRole('link', { name: title }).getAttribute('href')).toBe(expectedHref);
  });

  test.each([
    ['hi', 'संपादकीय', 'न्यूज़ पल्स के गहन संपादकीय और विशेष लेख।', 'संपादकीय और विशेष लेख खोजें...'],
    ['gu', 'સંપાદકીય', 'ન્યૂઝ પલ્સના વિશ્લેષણાત્મક સંપાદકીય અને વિશેષ લેખો.', 'સંપાદકીય અને વિશેષ લેખો શોધો...'],
  ])('renders localized %s editorial header copy', async (language, title, subtitle, placeholder) => {
    mockLanguage = language;
    renderEditorialPage([]);

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(subtitle)).toBeTruthy();
    expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
    expect(await screen.findByText('No stories yet.')).toBeTruthy();
  });
});
