import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import NewsSlugDetailPage, { ArticleFacebookEmbed, ArticleGallery, ArticleInstagramEmbed, ArticleXEmbed, ArticleYouTubeEmbed, getServerSideProps } from '../../pages/news/[slug]';
import { formatArticleBodyHtml } from '../../lib/articleBody';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { hasRenderedTwitterWidgetFrame, loadTwitterWidgetsIn } from '../../lib/xWidgets';

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

jest.mock('../../lib/xWidgets', () => ({
  hasRenderedTwitterWidgetFrame: jest.fn(() => true),
  loadTwitterWidgetsIn: jest.fn(() => Promise.resolve()),
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

function galleryImageMarker(mediaId: string, src: string, caption: string, credit = 'News Pulse / Staff') {
  return `<div data-np-block="inline-image" data-np-media-id="${mediaId}" data-np-src="${src}" data-np-caption="${caption}" data-np-credit="${credit}" data-np-width="1200" data-np-height="800"></div>`;
}

describe('pages/news/[slug] editorial detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hasRenderedTwitterWidgetFrame as jest.Mock).mockReturnValue(true);
    (loadTwitterWidgetsIn as jest.Mock).mockResolvedValue(undefined);
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

  test('renders controlled photo galleries with featured image, responsive grid, order, captions, and credits', async () => {
    const safeHtml = formatArticleBodyHtml(`<p>Before gallery.</p><div data-np-block="gallery">${galleryImageMarker('gallery_101', 'https://cdn.newspulse.co.in/images/gallery-1.jpg', 'Opening frame')}${galleryImageMarker('gallery_102', 'https://cdn.newspulse.co.in/images/gallery-2.jpg', 'Second frame')}${galleryImageMarker('gallery_103', 'https://cdn.newspulse.co.in/images/gallery-3.jpg', 'Third frame')}</div><p>After gallery.</p>`);

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

    const gallery = document.querySelector('section.np-gallery') as HTMLElement | null;
    const figures = gallery?.querySelectorAll('figure.np-gallery__item');
    const images = gallery?.querySelectorAll('img.np-gallery__media');
    const grid = gallery?.querySelector('.np-gallery__grid') as HTMLElement | null;

    expect(screen.getByText('Before gallery.')).toBeTruthy();
    expect(screen.getByText('After gallery.')).toBeTruthy();
    expect(screen.getByText('Photo Gallery')).toBeTruthy();
    expect(gallery?.getAttribute('data-np-block')).toBe('gallery');
    expect(figures).toHaveLength(3);
    expect(figures?.[0]?.className).toContain('np-gallery__item--featured');
    expect(grid?.className).toContain('np-gallery__grid--responsive');
    expect(grid?.querySelectorAll('figure.np-gallery__item')).toHaveLength(2);
    expect(images?.[0]?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/gallery-1.jpg');
    expect(images?.[1]?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/gallery-2.jpg');
    expect(images?.[2]?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/gallery-3.jpg');
    expect(images?.[0]?.getAttribute('loading')).toBe('lazy');
    expect(images?.[0]?.getAttribute('decoding')).toBe('async');
    expect((images?.[0]?.closest('.np-gallery__frame') as HTMLElement | null)?.getAttribute('style')).toContain('aspect-ratio: 1200 / 800');
    expect(screen.getByText('Opening frame')).toBeTruthy();
    expect(screen.getByText('Second frame')).toBeTruthy();
    expect(screen.getByText('Third frame')).toBeTruthy();
    expect(screen.getAllByText('Photo: News Pulse / Staff')).toHaveLength(3);
    expect(screen.queryByTestId('embedded-media-consent-gate')).toBeNull();
  });

  test('renders controlled photo galleries safely when marker alt is empty', async () => {
    const safeHtml = formatArticleBodyHtml('<div data-np-block="gallery"><div data-np-block="inline-image" data-np-media-id="gallery_empty_alt_render_1" data-np-src="https://cdn.newspulse.co.in/images/empty-alt-render-1.jpg" data-np-alt="" data-np-caption="Empty alt render caption one"></div><div data-np-block="inline-image" data-np-media-id="gallery_empty_alt_render_2" data-np-src="https://cdn.newspulse.co.in/images/empty-alt-render-2.jpg" data-np-alt="" data-np-caption="Empty alt render caption two"></div></div>');

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

    const firstImage = screen.getByAltText('Empty alt render caption one') as HTMLImageElement;
    const secondImage = screen.getByAltText('Empty alt render caption two') as HTMLImageElement;

    expect(screen.getByText('Photo Gallery')).toBeTruthy();
    expect(firstImage.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/empty-alt-render-1.jpg');
    expect(secondImage.getAttribute('src')).toBe('https://cdn.newspulse.co.in/images/empty-alt-render-2.jpg');
    expect(document.querySelectorAll('figure.np-gallery__item')).toHaveLength(2);
    expect(screen.queryByTestId('embedded-media-consent-gate')).toBeNull();

    fireEvent.error(firstImage);

    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.getByAltText('Empty alt render caption two')).toBeTruthy();
  });

  test('renders localized controlled gallery labels for EN, HI, and GU', () => {
    const gallery = {
      images: [
        { mediaId: 'gallery_101', src: 'https://cdn.newspulse.co.in/images/gallery-1.jpg', caption: 'Opening frame', credit: 'Photo: News Pulse' },
        { mediaId: 'gallery_102', src: 'https://cdn.newspulse.co.in/images/gallery-2.jpg', caption: 'Second frame', credit: 'Photo: News Pulse' },
      ],
    };

    for (const [language, label] of [['en', 'Photo Gallery'], ['hi', 'फोटो गैलरी'], ['gu', 'ફોટો ગેલેરી']] as const) {
      cleanup();
      render(<ArticleGallery gallery={gallery} lang={language} />);
      expect(screen.getByText(label)).toBeTruthy();
      expect(document.querySelector('section.np-gallery')?.getAttribute('data-np-block')).toBe('gallery');
    }
  });

  test('keeps a controlled gallery visible when one image fails', () => {
    render(
      <ArticleGallery
        lang="en"
        gallery={{
          images: [
            { mediaId: 'gallery_101', src: 'https://cdn.newspulse.co.in/images/gallery-1.jpg', alt: 'Gallery image one', caption: 'Opening frame' },
            { mediaId: 'gallery_102', src: 'https://cdn.newspulse.co.in/images/gallery-2.jpg', alt: 'Gallery image two', caption: 'Second frame' },
            { mediaId: 'gallery_103', src: 'https://cdn.newspulse.co.in/images/gallery-3.jpg', alt: 'Gallery image three', caption: 'Third frame' },
          ],
        }}
      />
    );

    const images = document.querySelectorAll('img.np-gallery__media');
    fireEvent.error(images[1]);

    expect(screen.getByText('Photo Gallery')).toBeTruthy();
    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.getByAltText('Gallery image one')).toBeTruthy();
    expect(screen.getByAltText('Gallery image three')).toBeTruthy();
    expect(document.querySelectorAll('figure.np-gallery__item')).toHaveLength(3);
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

  test('renders controlled Instagram article embeds with consent gate and responsive shell', async () => {
    const safeHtml = formatArticleBodyHtml('<p>Complete article content</p><div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/C0ffee_Post1/"></div><p>After Instagram paragraph.</p>');

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
    const iframe = screen.getByTitle('Instagram post') as HTMLIFrameElement;
    const figure = iframe.closest('figure');
    const frame = iframe.closest('.np-instagram-embed__frame') as HTMLElement | null;

    expect(screen.getByText('Complete article content')).toBeTruthy();
    expect(screen.getByText('After Instagram paragraph.')).toBeTruthy();
    expect(consentGate.getAttribute('data-title')).toBe('Instagram post');
    expect(consentGate.className).toContain('np-instagram-embed__consent');
    expect(iframe.getAttribute('src')).toBe('https://www.instagram.com/p/C0ffee_Post1/embed');
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('allow')).toContain('web-share');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(figure?.className).toContain('np-instagram-embed');
    expect(figure?.getAttribute('data-np-block')).toBe('instagram');
    expect(figure?.getAttribute('data-np-shortcode')).toBe('C0ffee_Post1');
    expect(frame).toBeTruthy();
  });

  test('renders controlled Instagram reel embeds from validated marker URLs', async () => {
    const safeHtml = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="Reel_Code9" data-np-url="https://www.instagram.com/reel/Reel_Code9/"></div>');

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

    expect(screen.getByTitle('Instagram post').getAttribute('src')).toBe('https://www.instagram.com/reel/Reel_Code9/embed');
  });

  test('renders the controlled Instagram fallback with the validated external link on failure', async () => {
    const stateSpy = jest.spyOn(React, 'useState');
    stateSpy.mockImplementationOnce(() => [true, jest.fn()] as any);

    render(
      <ArticleInstagramEmbed
        embed={{
          kind: 'p',
          shortcode: 'C0ffee_Post1',
          embedUrl: 'https://www.instagram.com/p/C0ffee_Post1/embed',
          url: 'https://www.instagram.com/p/C0ffee_Post1/',
        }}
      />
    );

    expect(screen.getByText('Instagram post unavailable')).toBeTruthy();
    const fallbackLink = screen.getByRole('link', { name: 'Open on Instagram' });
    expect(fallbackLink.getAttribute('href')).toBe('https://www.instagram.com/p/C0ffee_Post1/');
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByTitle('Instagram post')).toBeNull();

    stateSpy.mockRestore();
  });

  test('shows the controlled Instagram fallback when the post-consent iframe does not load', async () => {
    jest.useFakeTimers();

    try {
      render(
        <ArticleInstagramEmbed
          embed={{
            kind: 'p',
            shortcode: 'C0ffee_Post1',
            embedUrl: 'https://www.instagram.com/p/C0ffee_Post1/embed',
            url: 'https://www.instagram.com/p/C0ffee_Post1/',
          }}
        />
      );

      expect(screen.getByTitle('Instagram post')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(12000);
      });

      expect(screen.getByText('Instagram post unavailable')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Open on Instagram' }).getAttribute('href')).toBe('https://www.instagram.com/p/C0ffee_Post1/');
    } finally {
      jest.useRealTimers();
    }
  });

  test('renders EN, HI, and GU Instagram markers identically', async () => {
    for (const language of ['en', 'hi', 'gu'] as const) {
      cleanup();
      const safeHtml = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/C0ffee_Post1/"></div>');

      render(
        <NewsSlugDetailPage
          messages={{}}
          locale={language}
          lang={language}
          slug="special-story"
          siteUrl="https://www.newspulse.co.in"
          article={editorialArticle({ language }) as any}
          safeHtml={safeHtml}
          topStories={[]}
          relatedStories={[]}
          error={null}
          pending={false}
        />
      );

      expect(screen.getByTitle('Instagram post').getAttribute('src')).toBe('https://www.instagram.com/p/C0ffee_Post1/embed');
      expect(document.querySelector('figure.np-instagram-embed')?.getAttribute('data-np-shortcode')).toBe('C0ffee_Post1');
    }
  });

  test('renders controlled Facebook /posts/ embeds with consent gate and responsive shell', async () => {
    const safeHtml = formatArticleBodyHtml('<p>Complete article content</p><div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div><p>After Facebook paragraph.</p>');

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
    const iframe = screen.getByTitle('Facebook post') as HTMLIFrameElement;
    const figure = iframe.closest('figure');
    const frame = iframe.closest('.np-facebook-embed__frame') as HTMLElement | null;

    expect(screen.getByText('Complete article content')).toBeTruthy();
    expect(screen.getByText('After Facebook paragraph.')).toBeTruthy();
    expect(consentGate.getAttribute('data-title')).toBe('Facebook post');
    expect(consentGate.className).toContain('np-facebook-embed__consent');
    expect(iframe.getAttribute('src')).toBe('https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500');
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('allow')).toContain('web-share');
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(figure?.className).toContain('np-facebook-embed');
    expect(figure?.getAttribute('data-np-block')).toBe('facebook');
    expect(frame).toBeTruthy();
  });

  test('renders controlled Facebook permalink embeds from validated marker URLs', async () => {
    const safeHtml = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/permalink.php?story_fbid=pfbid02SafeStory123&id=123456789012345"></div>');

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

    expect(screen.getByTitle('Facebook post').getAttribute('src')).toBe('https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02SafeStory123%26id%3D123456789012345&show_text=true&width=500');
  });

  test('does not render Facebook iframe resources for articles without controlled Facebook blocks', async () => {
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

    expect(screen.queryByTitle('Facebook post')).toBeNull();
    expect(document.querySelector('figure.np-facebook-embed')).toBeNull();
  });

  test('renders the controlled Facebook fallback with the validated external link on failure', async () => {
    const stateSpy = jest.spyOn(React, 'useState');
    stateSpy.mockImplementationOnce(() => [true, jest.fn()] as any);

    render(
      <ArticleFacebookEmbed
        embed={{
          kind: 'post',
          embedUrl: 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500',
          url: 'https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123',
        }}
      />
    );

    expect(screen.getByText('Facebook post unavailable')).toBeTruthy();
    const fallbackLink = screen.getByRole('link', { name: 'Open on Facebook' });
    expect(fallbackLink.getAttribute('href')).toBe('https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123');
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByTitle('Facebook post')).toBeNull();

    stateSpy.mockRestore();
  });

  test('shows the controlled Facebook fallback when the post-consent iframe does not load', async () => {
    jest.useFakeTimers();

    try {
      render(
        <ArticleFacebookEmbed
          embed={{
            kind: 'post',
            embedUrl: 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500',
            url: 'https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123',
          }}
        />
      );

      expect(screen.getByTitle('Facebook post')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(12000);
      });

      expect(screen.getByText('Facebook post unavailable')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Open on Facebook' }).getAttribute('href')).toBe('https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123');
    } finally {
      jest.useRealTimers();
    }
  });

  test('renders EN, HI, and GU Facebook markers identically', async () => {
    for (const language of ['en', 'hi', 'gu'] as const) {
      cleanup();
      const safeHtml = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div>');

      render(
        <NewsSlugDetailPage
          messages={{}}
          locale={language}
          lang={language}
          slug="special-story"
          siteUrl="https://www.newspulse.co.in"
          article={editorialArticle({ language }) as any}
          safeHtml={safeHtml}
          topStories={[]}
          relatedStories={[]}
          error={null}
          pending={false}
        />
      );

      expect(screen.getByTitle('Facebook post').getAttribute('src')).toBe('https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500');
      expect(document.querySelector('figure.np-facebook-embed')?.getAttribute('data-np-block')).toBe('facebook');
    }
  });

  test('renders controlled X article embeds with consent gate responsive shell and shared loader', async () => {
    const safeHtml = formatArticleBodyHtml('<p>Complete article content</p><div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079"></div><p>After X paragraph.</p>');

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
    const figure = document.querySelector('figure.np-x-embed') as HTMLElement | null;
    const frame = document.querySelector('.np-x-embed__frame') as HTMLElement | null;
    const statusLink = document.querySelector('.np-x-embed__tweet a') as HTMLAnchorElement | null;

    expect(screen.getByText('Complete article content')).toBeTruthy();
    expect(screen.getByText('After X paragraph.')).toBeTruthy();
    expect(consentGate.getAttribute('data-title')).toBe('X post');
    expect(figure?.getAttribute('data-np-block')).toBe('x');
    expect(figure?.getAttribute('data-np-post-id')).toBe('2050104453630718079');
    expect(frame).toBeTruthy();
    expect(statusLink?.getAttribute('href')).toBe('https://x.com/i/status/2050104453630718079');
    expect(screen.getByRole('status').textContent).toBe('Loading X post...');
    await waitFor(() => expect(loadTwitterWidgetsIn).toHaveBeenCalledTimes(1));
  });

  test('does not initialize X widgets for articles without controlled X blocks', async () => {
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

    expect(loadTwitterWidgetsIn).not.toHaveBeenCalled();
    expect(document.querySelector('figure.np-x-embed')).toBeNull();
  });

  test('renders controlled X fallback with the validated external link on failure', async () => {
    (loadTwitterWidgetsIn as jest.Mock).mockRejectedValueOnce(new Error('blocked'));

    render(
      <ArticleXEmbed
        embed={{
          postId: '2050104453630718079',
          url: 'https://x.com/i/status/2050104453630718079',
        }}
      />
    );

    expect(await screen.findByText('X post unavailable')).toBeTruthy();
    const fallbackLink = screen.getByRole('link', { name: 'Open on X' });
    expect(fallbackLink.getAttribute('href')).toBe('https://x.com/i/status/2050104453630718079');
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('status')).toBeNull();
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
