import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import NewsSlugDetailPage, { ArticleYouTubeEmbed, getServerSideProps } from '../../pages/news/[slug]';
import { formatArticleBodyHtml } from '../../lib/articleBody';
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
  default: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
  ArticleHeroImage: ({ alt, src, fallbackSrc }: { alt: string; src?: string | null; fallbackSrc?: string }) => (
    <img alt={alt} src={src || fallbackSrc} data-testid="article-hero-image" />
  ),
}));

jest.mock('../../hooks/useArticleAnalytics', () => ({
  useArticleAnalytics: jest.fn(),
}));

jest.mock('../../lib/publicDataRefresh', () => ({
  subscribePublicDataRefresh: () => jest.fn(),
}));

jest.mock('../../src/consent/EmbeddedMediaConsentGate', () => ({
  __esModule: true,
  default: ({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) => (
    <div data-testid="embedded-media-consent-gate" data-title={title} className={className}>
      {children}
    </div>
  ),
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

  test('renders article detail hero with the resolved shared article image', async () => {
    const imageUrl = 'https://res.cloudinary.com/dc918or5b/image/upload/v1788930962/newspulse/articles/tvo76azi8mlvnqziihay.png';

    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle({ imageUrl, coverImage: { url: imageUrl }, coverImageUrl: imageUrl }) as any}
        safeHtml="<p>Complete article content</p>"
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    expect(screen.getByTestId('article-hero-image').getAttribute('src')).toBe(imageUrl);
  });

  test('renders controlled inline article images responsively with caption, credit, and fallback', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle() as any}
        safeHtml={'<p>Complete article content</p><figure class="np-inline-image" data-np-block="inline-image" data-np-media-id="media_123"><img class="np-inline-image__media" src="https://cdn.newspulse.co.in/images/story.jpg" alt="Flood rescue image" width="1200" height="800" loading="lazy" decoding="async" /><figcaption class="np-inline-image__caption"><span class="np-inline-image__caption-text" data-np-caption="true">Flood rescue image</span><span class="np-inline-image__credit" data-np-credit="true">Photo: News Pulse / Staff</span></figcaption></figure><p>After image paragraph.</p>'}
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    const inlineImage = screen.getByAltText('Flood rescue image') as HTMLImageElement;
    const figure = inlineImage.closest('figure');
    const frame = inlineImage.closest('.np-inline-image__frame') as HTMLElement | null;

    expect(inlineImage.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/story.jpg');
    expect(inlineImage.getAttribute('loading')).toBe('lazy');
    expect(inlineImage.getAttribute('decoding')).toBe('async');
    expect(inlineImage.getAttribute('width')).toBe('1200');
    expect(inlineImage.getAttribute('height')).toBe('800');
    expect(inlineImage.className).toContain('np-inline-image__media');
    expect(figure?.className).toContain('np-inline-image');
    expect(figure?.getAttribute('data-np-media-id')).toBe('media_123');
    expect(frame?.getAttribute('style')).toContain('aspect-ratio: 1200 / 800');
    expect(screen.getByText('Flood rescue image')).toBeTruthy();
    expect(screen.getByText('Photo: News Pulse / Staff')).toBeTruthy();

    fireEvent.error(inlineImage);

    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.getByText('Photo: News Pulse / Staff')).toBeTruthy();
  });

  test('renders controlled YouTube article embeds with consent gate responsive shell and fallback', async () => {
    const safeHtml = formatArticleBodyHtml('<p>Complete article content</p><div data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK"></div><p>After video paragraph.</p>');

    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle() as any}
        safeHtml={safeHtml}
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    const consentGate = screen.getByTestId('embedded-media-consent-gate');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    const figure = iframe.closest('figure');
    const frame = iframe.closest('.np-youtube-embed__frame') as HTMLElement | null;

    expect(screen.getByText('Complete article content')).toBeTruthy();
    expect(screen.getByText('After video paragraph.')).toBeTruthy();
    expect(consentGate.getAttribute('data-title')).toBe('YouTube video');
    expect(consentGate.className).toContain('absolute inset-0');
    expect(iframe.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1');
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('allow')).toContain('encrypted-media');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(figure?.className).toContain('np-youtube-embed');
    expect(figure?.getAttribute('data-np-block')).toBe('youtube');
    expect(figure?.getAttribute('data-np-video-id')).toBe('AbCdEfGhIjK');
    expect(frame?.getAttribute('style')).toContain('aspect-ratio: 16 / 9');

  });

  test('renders the controlled YouTube fallback without breaking article layout', async () => {
    const stateSpy = jest.spyOn(React, 'useState');
    stateSpy.mockImplementationOnce(() => [true, jest.fn()] as any);

    render(
      <ArticleYouTubeEmbed
        embed={{
          videoId: 'AbCdEfGhIjK',
          embedUrl: 'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
          url: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
        }}
      />
    );

    expect(screen.getByText('Video unavailable')).toBeTruthy();
    const fallbackLink = screen.getByRole('link', { name: 'Watch on YouTube' });
    expect(fallbackLink.getAttribute('href')).toBe('https://www.youtube.com/watch?v=AbCdEfGhIjK');
    expect(screen.queryByTitle('YouTube video')).toBeNull();

    stateSpy.mockRestore();
  });

  test('uses the article detail placeholder only when no usable image resolves', async () => {
    render(
      <NewsSlugDetailPage
        messages={{}}
        locale="en"
        lang="en"
        slug="special-story"
        siteUrl="https://www.newspulse.co.in"
        article={editorialArticle({ imageUrl: 'C:\\fakepath\\broken.jpg', coverImage: null, coverImageUrl: '' }) as any}
        safeHtml="<p>Complete article content</p>"
        topStories={[]}
        relatedStories={[]}
        error={null}
        pending={false}
      />
    );

    expect(screen.getByTestId('article-hero-image').getAttribute('src')).toBe('/fallback.svg');
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

  test('keeps article sidebar minimal without Home right-rail modules', async () => {
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

    expect(screen.getAllByText('HOME_RIGHT_300x250')).toHaveLength(1);
    expect(screen.queryByText('HOME_RIGHT_300x600')).toBeNull();
    expect(screen.queryByText('Latest News Sidebar Story')).toBeNull();
    expect(screen.queryByText('Drone Video Feature')).toBeNull();
    expect(screen.queryByText('Campus Youth Desk Story')).toBeNull();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Regional' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'National' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'International' })).toBeNull();
    expect(screen.queryByText('HOME_RIGHT_300x600')).toBeNull();
    expect(screen.queryByText('LATEST')).toBeNull();
    expect(screen.queryByText('YOUTH DESK')).toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
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
