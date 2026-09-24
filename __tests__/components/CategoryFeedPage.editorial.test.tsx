import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import CategoryFeedPage, { selectCategoryFeedArticles } from '../../components/CategoryFeedPage';
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
      'categories.pulseDialogue': 'Pulse Dialogue',
      'pulseDialogue.landing.description': 'Signed public contributions from outside voices, clearly labelled and edited by News Pulse.',
      'pulseDialogue.landing.featuredDialogue': 'Featured Dialogue',
      'pulseDialogue.landing.latestContributions': 'Latest Contributions',
      'pulseDialogue.formats.guestColumn': 'Guest Column',
    } as Record<string, string>)[key] || key,
  }),
}));

jest.mock('../../components/NewsPulseCategoryShell', () => ({
  __esModule: true,
  default: ({ topContent, children }: { topContent?: React.ReactNode; children: React.ReactNode }) => (
    <main>
      {topContent}
      {children}
    </main>
  ),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
  }),
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} data-testid="top-story-image" />,
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

function renderPulseDialoguePage(items: any[]) {
  (fetchPublicNews as jest.Mock).mockResolvedValue({ items, meta: {}, endpoint: '/api/public/news' });
  return render(<CategoryFeedPage title="Pulse Dialogue" categoryKey="pulse-dialogue" useCategoryShell />);
}

function renderPulseDialoguePageWithCurrentFetch(props: Partial<React.ComponentProps<typeof CategoryFeedPage>> = {}) {
  return render(<CategoryFeedPage title="Pulse Dialogue" categoryKey="pulse-dialogue" useCategoryShell {...props} />);
}

function pulseDialogueArticle(index: number, overrides: Record<string, any> = {}) {
  return mockArticle({
    _id: `pulse-${index}`,
    category: 'pulse-dialogue',
    slug: `pulse-${index}`,
    title: `Pulse Dialogue ${index}`,
    publishedAt: `2026-01-${String(index).padStart(2, '0')}T10:00:00.000Z`,
    pulseDialogue: {
      dialogueFormat: 'guest_column',
      bylineSnapshot: { name: `Contributor ${index}` },
    },
    ...overrides,
  });
}

describe('CategoryFeedPage editorial listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  afterEach(() => {
    cleanup();
  });

  test('selects the newest published same-category article as the category lead', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'older', title: 'Older Published', slug: 'older', category: 'business', publishedAt: '2026-01-01T10:00:00.000Z' }),
      mockArticle({ _id: 'newer', title: 'Newer Published', slug: 'newer', category: 'business', publishedAt: '2026-01-03T10:00:00.000Z' }),
    ], 'business');

    expect(selected.map((article) => article._id)).toEqual(['newer', 'older']);
  });

  test('keeps older published category articles secondary when a newer article exists', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'article-a', category: 'national', publishedAt: '2026-01-01T10:00:00.000Z' }),
      mockArticle({ _id: 'article-b', category: 'national', publishedAt: '2026-01-02T10:00:00.000Z' }),
      mockArticle({ _id: 'article-c', category: 'national', publishedAt: '2026-01-03T10:00:00.000Z' }),
    ], 'national');

    expect(selected[0]._id).toBe('article-c');
    expect(selected.slice(1).map((article) => article._id)).toEqual(['article-b', 'article-a']);
  });

  test('publishing a newer same-category article changes the lead', () => {
    const before = selectCategoryFeedArticles([
      mockArticle({ _id: 'pulse-a', category: 'pulse-dialogue', publishedAt: '2026-01-01T10:00:00.000Z' }),
    ], 'pulse-dialogue');
    const after = selectCategoryFeedArticles([
      mockArticle({ _id: 'pulse-a', category: 'pulse-dialogue', publishedAt: '2026-01-01T10:00:00.000Z' }),
      mockArticle({ _id: 'pulse-b', category: 'pulse-dialogue', publishedAt: '2026-01-04T10:00:00.000Z' }),
    ], 'pulse-dialogue');

    expect(before[0]._id).toBe('pulse-a');
    expect(after[0]._id).toBe('pulse-b');
    expect(after[1]._id).toBe('pulse-a');
  });

  test('does not promote an older article merely because updatedAt changed', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({
        _id: 'old-edited',
        category: 'sports',
        publishedAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-09T10:00:00.000Z',
      }),
      mockArticle({
        _id: 'newer-published',
        category: 'sports',
        publishedAt: '2026-01-03T10:00:00.000Z',
        updatedAt: '2026-01-03T11:00:00.000Z',
      }),
    ], 'sports');

    expect(selected.map((article) => article._id)).toEqual(['newer-published', 'old-edited']);
  });

  test.each([
    ['draft', { status: 'draft' }],
    ['unpublished', { status: 'unpublished' }],
    ['archived', { status: 'archived' }],
    ['deleted', { status: 'published', deleted: true }],
    ['future scheduled', { status: 'published', publishedAt: '2099-01-01T10:00:00.000Z' }],
  ])('%s article does not become the category lead', (_label, overrides) => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'eligible', category: 'lifestyle', publishedAt: '2026-01-01T10:00:00.000Z' }),
      mockArticle({ _id: 'ineligible', category: 'lifestyle', publishedAt: '2026-01-05T10:00:00.000Z', ...overrides }),
    ], 'lifestyle');

    expect(selected.map((article) => article._id)).toEqual(['eligible']);
  });

  test('does not mix articles from other categories into a category lead list', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'new-national', category: 'national', publishedAt: '2026-01-05T10:00:00.000Z' }),
      mockArticle({ _id: 'business-lead', category: 'business', publishedAt: '2026-01-02T10:00:00.000Z' }),
    ], 'business');

    expect(selected.map((article) => article._id)).toEqual(['business-lead']);
  });

  test('returns no category lead candidates when the feed has no same-category articles', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'new-national', category: 'national', publishedAt: '2026-01-05T10:00:00.000Z' }),
    ], 'business');

    expect(selected).toEqual([]);
  });

  test('Pulse Dialogue follows the same newest published same-category lead behavior', () => {
    const selected = selectCategoryFeedArticles([
      mockArticle({ _id: 'older-dialogue', category: 'pulse-dialogue', publishedAt: '2026-01-01T10:00:00.000Z' }),
      mockArticle({ _id: 'newer-dialogue', category: 'pulse-dialogue', publishedAt: '2026-01-06T10:00:00.000Z' }),
      mockArticle({ _id: 'newer-national', category: 'national', publishedAt: '2026-01-07T10:00:00.000Z' }),
    ], 'pulse-dialogue');

    expect(selected.map((article) => article._id)).toEqual(['newer-dialogue', 'older-dialogue']);
  });

  test('renders Pulse Dialogue loading structure immediately instead of a blank story area', async () => {
    let resolveFeed: (value: any) => void = () => undefined;
    (fetchPublicNews as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveFeed = resolve; }));

    renderPulseDialoguePageWithCurrentFetch();

    const loadingRegion = screen.getByTestId('category-story-loading');
    expect(loadingRegion).toBeTruthy();
    expect(screen.getAllByText('Pulse Dialogue').length).toBeGreaterThanOrEqual(2);
    expect(fetchPublicNews).toHaveBeenCalledTimes(1);

    resolveFeed({ items: [], meta: {}, endpoint: '/api/public/news' });
    expect(await screen.findByText('No stories yet.')).toBeTruthy();
  });

  test('loaded Pulse Dialogue story replaces the loading skeleton', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValue({
      items: [pulseDialogueArticle(1, { title: 'Loaded Pulse Dialogue', coverImageUrl: '/covers/loaded-pulse.jpg' })],
      meta: {},
      endpoint: '/api/public/news',
    });

    renderPulseDialoguePageWithCurrentFetch();

    expect(screen.getByTestId('category-story-loading')).toBeTruthy();
    expect(await screen.findByText('Loaded Pulse Dialogue')).toBeTruthy();
    expect(screen.queryByTestId('category-story-loading')).toBeNull();
    expect(screen.getByAltText('Loaded Pulse Dialogue').getAttribute('src')).toBe('/covers/loaded-pulse.jpg');
  });

  test('valid initial Pulse Dialogue data renders immediately while client refresh is pending', () => {
    (fetchPublicNews as jest.Mock).mockReturnValue(new Promise(() => undefined));

    renderPulseDialoguePageWithCurrentFetch({
      initialItems: [pulseDialogueArticle(1, { title: 'Initial Pulse Dialogue', coverImageUrl: '/covers/initial-pulse.jpg' })],
    });

    expect(screen.getByText('Initial Pulse Dialogue')).toBeTruthy();
    expect(screen.queryByTestId('category-story-loading')).toBeNull();
    expect(screen.getByAltText('Initial Pulse Dialogue').getAttribute('src')).toBe('/covers/initial-pulse.jpg');
    expect(fetchPublicNews).toHaveBeenCalledTimes(1);
  });

  test('failed Pulse Dialogue fetch renders a safe non-blank error state', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news', error: 'API 503' });

    renderPulseDialoguePageWithCurrentFetch();

    expect(screen.getByTestId('category-story-loading')).toBeTruthy();
    expect(await screen.findByText('Unable to load stories')).toBeTruthy();
    expect(screen.getByText('API 503')).toBeTruthy();
  });

  test('empty Pulse Dialogue category state remains correct after loading completes', async () => {
    renderPulseDialoguePage([]);

    expect(screen.getByTestId('category-story-loading')).toBeTruthy();
    expect(await screen.findByText('No stories yet.')).toBeTruthy();
    expect(screen.queryByTestId('category-story-loading')).toBeNull();
  });

  test('Pulse Dialogue initial render performs one category feed request', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValue({
      items: [pulseDialogueArticle(1, { title: 'Single Request Dialogue' })],
      meta: {},
      endpoint: '/api/public/news',
    });

    renderPulseDialoguePageWithCurrentFetch();

    expect(await screen.findByText('Single Request Dialogue')).toBeTruthy();
    expect(fetchPublicNews).toHaveBeenCalledTimes(1);
    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({
      category: 'pulse-dialogue',
      language: 'en',
      limit: 30,
      extraQuery: { strictLocale: '1' },
    }));
  });

  test('displays a clean empty editorial state and fetches all published editorial records', async () => {
    renderEditorialPage([]);

    expect(screen.getByRole('heading', { name: 'Editorial Desk' })).toBeTruthy();
    expect(screen.getByText('News Pulse opinions, analysis, perspectives and in-depth commentary.')).toBeTruthy();
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
    expect(screen.queryByText('OPINION')).toBeNull();
    expect(screen.queryByText('ANALYSIS')).toBeNull();
    expect(screen.queryByText('COMMENTARY')).toBeNull();
    expect(screen.queryByText('EXPLAINER')).toBeNull();
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

  test('excludes draft articles from category cards', async () => {
    renderEditorialPage([
      mockArticle({ _id: 'published-editorial', slug: 'published-editorial', title: 'Published Editorial' }),
      mockArticle({ _id: 'draft-editorial', slug: 'draft-editorial', title: 'Draft Editorial', status: 'draft' }),
    ]);

    expect(await screen.findByText('Published Editorial')).toBeTruthy();
    expect(screen.queryByText('Draft Editorial')).toBeNull();
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
    ['hi', 'संपादकीय और विशेष लेख खोजें...'],
    ['gu', 'સંપાદકીય અને વિશેષ લેખો શોધો...'],
  ])('renders localized %s editorial search copy with the shared desk header', async (language, placeholder) => {
    mockLanguage = language;
    renderEditorialPage([]);

    expect(screen.getByRole('heading', { name: 'Editorial Desk' })).toBeTruthy();
    expect(screen.getByText('News Pulse opinions, analysis, perspectives and in-depth commentary.')).toBeTruthy();
    expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
    expect(await screen.findByText('No stories yet.')).toBeTruthy();
  });

  test('renders Pulse Dialogue landing copy and contributor metadata without replacing the article cover', async () => {
    renderPulseDialoguePage([
      mockArticle({
        _id: 'pulse-1',
        category: 'pulse-dialogue',
        slug: 'city-dialogue',
        title: 'A City Dialogue',
        summary: 'A signed public contribution.',
        coverImageUrl: '/covers/city-dialogue.jpg',
        authorName: 'News Pulse Desk',
        readingTime: 4,
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          series: 'Civic Lens',
          bylineSnapshot: {
            name: 'Dr Asha Mehta',
            designation: 'Urban Planner',
            affiliation: 'Civic Futures',
            photo: { url: '/contributors/asha.jpg', alt: 'Dr Asha Mehta portrait' },
          },
          contributor: {
            shortBio: 'Writes on cities.',
          },
        },
      }),
      ...Array.from({ length: 5 }, (_, index) => mockArticle({
        _id: `pulse-extra-${index + 2}`,
        category: 'pulse-dialogue',
        slug: `extra-dialogue-${index + 2}`,
        title: `Extra Dialogue ${index + 2}`,
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          bylineSnapshot: { name: `Contributor ${index + 2}` },
        },
      })),
    ]);

    expect(await screen.findByText('A City Dialogue')).toBeTruthy();
    expect(screen.getByText('Signed public contributions from outside voices, clearly labelled and edited by News Pulse.')).toBeTruthy();
    expect(screen.getByText('Featured Dialogue')).toBeTruthy();
    expect(screen.getByText('Latest Contributions')).toBeTruthy();
    expect(screen.getAllByText('Guest Column').length).toBeGreaterThan(0);
    expect(screen.getByText('Civic Lens')).toBeTruthy();
    expect(screen.getByText(/By\s+Dr Asha Mehta/)).toBeTruthy();
    expect(screen.getByText('Urban Planner')).toBeTruthy();
    expect(screen.getByText('Civic Futures')).toBeTruthy();
    expect(screen.getByAltText('Dr Asha Mehta portrait').getAttribute('src')).toBe('/contributors/asha.jpg');
    expect(screen.getByAltText('A City Dialogue').getAttribute('src')).toBe('/covers/city-dialogue.jpg');
    expect(screen.queryByText('By News Pulse Desk')).toBeNull();
  });

  test('renders a latest Pulse contribution contributor portrait without replacing the story image', async () => {
    renderPulseDialoguePage([
      pulseDialogueArticle(6, { title: 'Newest Lead Dialogue', coverImageUrl: '/covers/newest-lead.jpg' }),
      pulseDialogueArticle(5),
      pulseDialogueArticle(4),
      pulseDialogueArticle(3),
      pulseDialogueArticle(2),
      pulseDialogueArticle(1, {
        title: 'Latest Row Dialogue',
        coverImageUrl: '/covers/latest-row.jpg',
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          bylineSnapshot: {
            name: 'Latest Row Contributor',
            designation: 'Independent Writer',
            photo: { url: '/contributors/latest-row.jpg', alt: 'Latest row contributor portrait' },
          },
        },
      }),
    ]);

    expect(await screen.findByText('Latest Row Dialogue')).toBeTruthy();
    expect(screen.getByAltText('Latest row contributor portrait').getAttribute('src')).toBe('/contributors/latest-row.jpg');
    expect(screen.getByAltText('Latest Row Dialogue').getAttribute('src')).toBe('/covers/latest-row.jpg');
  });

  test('uses contributor.photo fallback and never the cover image for Pulse contributor portraits', async () => {
    renderPulseDialoguePage([
      pulseDialogueArticle(1, {
        title: 'Contributor Photo Fallback Dialogue',
        coverImageUrl: '/covers/contributor-fallback-cover.jpg',
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          bylineSnapshot: {
            name: 'Fallback Photo Contributor',
            designation: 'Columnist',
          },
          contributor: {
            name: 'Fallback Photo Contributor',
            photo: { url: '/contributors/fallback-person.jpg', alt: 'Fallback person portrait' },
          },
        },
      }),
    ]);

    expect(await screen.findByText('Contributor Photo Fallback Dialogue')).toBeTruthy();
    expect(screen.getByAltText('Fallback person portrait').getAttribute('src')).toBe('/contributors/fallback-person.jpg');
    expect(screen.getByAltText('Contributor Photo Fallback Dialogue').getAttribute('src')).toBe('/covers/contributor-fallback-cover.jpg');
    expect(document.querySelector('img[src="/covers/contributor-fallback-cover.jpg"]')?.getAttribute('alt')).toBe('Contributor Photo Fallback Dialogue');
  });

  test('renders text-only Pulse latest attribution cleanly when contributor photo is missing', async () => {
    renderPulseDialoguePage([
      pulseDialogueArticle(6, { title: 'Lead Before Text Only' }),
      pulseDialogueArticle(5),
      pulseDialogueArticle(4),
      pulseDialogueArticle(3),
      pulseDialogueArticle(2),
      pulseDialogueArticle(1, {
        title: 'Text Only Latest Dialogue',
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          bylineSnapshot: {
            name: 'Text Only Contributor',
            designation: 'Independent Writer',
          },
        },
      }),
    ]);

    expect(await screen.findByText('Text Only Latest Dialogue')).toBeTruthy();
    expect(screen.getByText(/By\s+Text Only Contributor/)).toBeTruthy();
    expect(screen.getByText('Independent Writer')).toBeTruthy();
    expect(screen.queryByAltText('Text Only Contributor')).toBeNull();
  });

  test.each([
    ['en', 'Shared English Dialogue', '/contributors/shared-person.jpg'],
    ['hi', 'साझા સંવાદ', '/contributors/shared-person.jpg'],
    ['gu', 'સાંઝો સંવાદ', '/contributors/shared-person.jpg'],
  ])('renders Pulse contributor photo safely for %s category cards', async (language, title, photoUrl) => {
    mockLanguage = language;
    renderPulseDialoguePage([
      pulseDialogueArticle(1, {
        _id: `shared-${language}`,
        language,
        title,
        slug: `shared-${language}`,
        coverImageUrl: `/covers/shared-${language}.jpg`,
        pulseDialogue: {
          dialogueFormat: 'guest_column',
          bylineSnapshot: {
            name: 'Shared Contributor',
            designation: 'Independent Writer',
            photo: { url: photoUrl, alt: 'Shared contributor portrait' },
          },
        },
      }),
    ]);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByAltText('Shared contributor portrait').getAttribute('src')).toBe(photoUrl);
    expect(screen.getByAltText(title).getAttribute('src')).toBe(`/covers/shared-${language}.jpg`);
  });

  test('keeps Pulse Dialogue cards safe when contributor metadata is missing', async () => {
    renderPulseDialoguePage([
      mockArticle({
        _id: 'pulse-missing',
        category: 'pulse-dialogue',
        slug: 'missing-contributor',
        title: 'Dialogue Without Public Contributor',
        pulseDialogue: null,
        authorName: 'News Pulse Desk',
      }),
    ]);

    expect(await screen.findByText('Dialogue Without Public Contributor')).toBeTruthy();
    expect(screen.queryByText('By News Pulse Desk')).toBeNull();
  });
});
