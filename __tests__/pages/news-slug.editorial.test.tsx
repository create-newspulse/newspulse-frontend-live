import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import NewsSlugDetailPage, { getServerSideProps } from '../../pages/news/[slug]';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('../../src/i18n/LanguageProvider', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.home': 'Home',
      'common.share': 'Share',
      'common.relatedStories': 'Related Stories',
      'common.noResults': 'No related stories yet.',
      'common.trending': 'Trending Topics',
      'common.topStories': 'Top Stories',
      'common.loading': 'Loading...',
      'common.viewAll': 'View all',
      'common.untitled': 'Untitled',
      'home.youthPulseTrending': 'Youth Pulse Trending',
      'categories.viralVideos': 'Viral Videos',
      'brand.name': 'News Pulse',
    } as Record<string, string>)[key] || key,
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { slug: 'special-story' },
    asPath: '/news/special-story',
  }),
}));

jest.mock('../../src/components/ads/AdSlot', () => ({
  __esModule: true,
  default: ({ slot }: { slot: string }) => <div data-testid="ad-slot">{slot}</div>,
}));

jest.mock('../../src/components/category/CategoryHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <header data-testid="category-header">{title}</header>,
}));

jest.mock('../../features/youthPulse/useYouthPulse', () => ({
  useYouthPulse: () => ({
    trending: [{ id: 'youth-1', title: 'Campus Youth Desk Story' }],
    loading: false,
  }),
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
  ArticleHeroImage: ({ alt }: { alt: string }) => <img alt={alt} data-testid="article-hero-image" />,
}));

jest.mock('../../hooks/useArticleAnalytics', () => ({
  useArticleAnalytics: jest.fn(),
}));

jest.mock('../../lib/publicDataRefresh', () => ({
  subscribePublicDataRefresh: () => jest.fn(),
}));

jest.mock('../../lib/publicNewsApi', () => {
  const actual = jest.requireActual('../../lib/publicNewsApi');
  return {
    ...actual,
    fetchPublicNews: jest.fn(() => Promise.resolve({ items: [], meta: {}, endpoint: '/api/public/news' })),
    fetchPublicNewsGroup: jest.fn(() => Promise.resolve({ items: [], endpoint: '/api/public/news/group/group-1' })),
  };
});

function editorialArticle(overrides: Record<string, any> = {}) {
  return {
    _id: 'editorial-1',
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    category: 'editorial',
    editorialType: 'special_story',
    language: 'en',
    title: 'Inside Gujarat Water Situation',
    summary: 'A reported editorial subheadline.',
    content: '<p>Complete article content</p>',
    slug: 'special-story',
    authorName: 'Authorised Editor',
    authorDesignation: 'Editor, News Pulse',
    imageCaption: 'Water situation image caption',
    imageCredit: 'News Pulse Photo Desk',
    ...overrides,
  };
}

describe('pages/news/[slug] editorial detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ items: [] }) })) as any;
    (fetchPublicNews as jest.Mock).mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news' });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders editorial detail fields without mixing author role and editorial type', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle() as any}
        safeHtml="<p>Complete article content</p>"
        topStories={[]}
        relatedStories={[editorialArticle({ _id: 'related-1', slug: 'related-editorial', title: 'Related Editorial', summary: 'Related summary' }) as any]}
        error={null}
        pending={false}
      />
    );

    expect(screen.getByText('SPECIAL STORY')).toBeTruthy();
    expect(screen.getByText('Inside Gujarat Water Situation')).toBeTruthy();
    expect(screen.getByText('A reported editorial subheadline.')).toBeTruthy();
    expect(screen.getByText(/By Authorised Editor/)).toBeTruthy();
    expect(screen.getByText(/Editor, News Pulse/)).toBeTruthy();
    expect(screen.getByText(/Published/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.getByText('Water situation image caption')).toBeTruthy();
    expect(screen.getByText('News Pulse Photo Desk')).toBeTruthy();
    expect(screen.getByText('Complete article content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByText('Related Editorial')).toBeTruthy();
    expect(screen.queryByText(/Founder.s Voice|Opinion|Analysis|Commentary|Explainer/i)).toBeNull();
  });

  test('renders Gujarati article title, summary, and content on Gujarati detail routes', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="gu"
        lang="gu"
        slug="javabdar-digital-patrakarita"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle({
          _id: 'article-gu',
          language: 'gu',
          title: 'જવાબદાર ડિજિટલ પત્રકારિતા શા માટે જરૂરી છે',
          summary: 'ગુજરાતી લેખનો સારાંશ',
          content: '<p>ગુજરાતી લેખની સંપૂર્ણ સામગ્રી</p>',
          slug: 'javabdar-digital-patrakarita',
          editorialType: 'editorial',
          image: { gu: { alt: 'ગુજરાતી છબી વર્ણન' } },
        }) as any}
        safeHtml="<p>ગુજરાતી લેખની સંપૂર્ણ સામગ્રી</p>"
        topStories={[]}
        relatedStories={[
          editorialArticle({
            _id: 'related-gu',
            language: 'gu',
            title: 'સંબંધિત ગુજરાતી સમાચાર',
            summary: 'સંબંધિત ગુજરાતી સારાંશ',
            content: '<p>સંબંધિત ગુજરાતી સામગ્રી</p>',
            slug: 'related-gujarati-news',
          }) as any,
          editorialArticle({
            _id: 'related-en',
            language: 'en',
            title: 'Related English News',
            summary: 'Related English summary',
            content: '<p>Related English body</p>',
            slug: 'related-english-news',
          }) as any,
        ]}
        error={null}
        pending={false}
      />
    );

    expect(screen.getByText('EDITORIAL')).toBeTruthy();
    expect(document.body.textContent).toContain('જવાબદાર ડિજિટલ પત્રકારિતા શા માટે જરૂરી છે');
    expect(screen.getByText('ગુજરાતી લેખનો સારાંશ')).toBeTruthy();
    expect(screen.getByText('ગુજરાતી લેખની સંપૂર્ણ સામગ્રી')).toBeTruthy();
    expect(screen.getByTestId('article-hero-image').getAttribute('alt')).toBe('ગુજરાતી છબી વર્ણન');
    expect(screen.getByText('સંબંધિત ગુજરાતી સમાચાર')).toBeTruthy();
    expect(screen.queryByText('Related English News')).toBeNull();
    expect(screen.queryByLabelText('Article language')).toBeNull();
    expect(screen.queryByText('EN')).toBeNull();
    expect(screen.queryByText('HI')).toBeNull();
    expect(screen.queryByText('GU')).toBeNull();
    expect(screen.queryByText('Why Responsible Digital Journalism Matters More Than Ever')).toBeNull();
    expect(screen.queryByText('English article body')).toBeNull();
  });

  test('renders Hindi article body on Hindi detail routes', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="hi"
        lang="hi"
        slug="jimmedar-digital-patrakarita"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle({
          _id: 'article-hi',
          language: 'hi',
          title: 'जिम्मेदार डिजिटल पत्रकारिता क्यों जरूरी है',
          summary: 'हिंदी लेख का सारांश',
          content: '<p>हिंदी लेख की पूरी सामग्री</p>',
          slug: 'jimmedar-digital-patrakarita',
          editorialType: 'editorial',
        }) as any}
        safeHtml="<p>हिंदी लेख की पूरी सामग्री</p>"
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    expect(document.body.textContent).toContain('जिम्मेदार डिजिटल पत्रकारिता क्यों जरूरी है');
    expect(screen.getByText('हिंदी लेख का सारांश')).toBeTruthy();
    expect(screen.getByText('हिंदी लेख की पूरी सामग्री')).toBeTruthy();
    expect(screen.queryByText('Inside Gujarat Water Situation')).toBeNull();
  });

  test('shows pending translation copy with source-language reading option', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="gu"
        lang="gu"
        slug="pending-story"
        siteUrl="https://www.newspulse.co.in"
        article={null}
        safeHtml=""
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending
        pendingSourceLang="en"
      />
    );

    expect(screen.getByText('This article is being prepared in Gujarati.')).toBeTruthy();
    const readSource = screen.getByText('Read in English').closest('a');
    expect(readSource?.getAttribute('href')).toBe('/news/pending-story');
  });

  test('orders article sidebar as advertisement, Latest News, Drone Video, then Youth Desk', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValue({
      items: [
        editorialArticle({ _id: 'latest-1', category: 'national', title: 'Latest News Sidebar Story', slug: 'latest-news-sidebar-story' }),
      ],
      meta: {},
      endpoint: '/api/public/news',
    });

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({
        items: [{
          id: 'drone-video-1',
          title: 'Drone Video Feature',
          videoFileUrl: 'https://cdn.example.com/drone-video.mp4',
          posterImageUrl: 'https://cdn.example.com/drone-video.jpg',
          showOnHomepage: true,
        }],
      }),
    })) as any;

    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle() as any}
        safeHtml="<p>Complete article content</p>"
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    expect(await screen.findByText('Latest News Sidebar Story')).toBeTruthy();
    expect(await screen.findByText('Drone Video Feature')).toBeTruthy();
    expect(await screen.findByText('Campus Youth Desk Story')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regional' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'National' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'International' })).toBeTruthy();
    expect(screen.queryByText('HOME_RIGHT_300x600')).toBeNull();

    const topAd = screen.getByText('HOME_RIGHT_300x250');
    const latestHeading = screen.getByText('LATEST');
    const droneTitle = screen.getByText('Drone Video Feature');
    const youthHeading = screen.getByText('YOUTH DESK');
    const playButton = screen.getByRole('button', { name: 'Play Drone Video Feature' });

    expect(Boolean(topAd.compareDocumentPosition(latestHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(latestHeading.compareDocumentPosition(droneTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(droneTitle.compareDocumentPosition(youthHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getAllByText('HOME_RIGHT_300x250')).toHaveLength(1);
    expect(playButton.closest('.video-card-media')?.className || '').toContain('aspect-[9/16]');

    fireEvent.click(playButton);
    expect(screen.queryByRole('button', { name: 'Play Drone Video Feature' })).toBeNull();
  });

  test('returns 404 for invalid or unavailable public articles', async () => {
    const baseCtx: any = {
      locale: 'en',
      params: { slug: 'missing-editorial' },
      req: { headers: { host: 'localhost:3000' } },
      res: { setHeader: jest.fn() },
    };

    global.fetch = jest.fn(() => Promise.resolve({ json: async () => ({ article: null }) })) as any;
    await expect(getServerSideProps(baseCtx)).resolves.toEqual({ notFound: true });

    global.fetch = jest.fn(() => Promise.resolve({ json: async () => ({ article: editorialArticle({ status: 'archived' }) }) })) as any;
    await expect(getServerSideProps(baseCtx)).resolves.toEqual({ notFound: true });
  });
});
