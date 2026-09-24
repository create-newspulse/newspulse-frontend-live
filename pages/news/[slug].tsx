import type { GetServerSideProps } from 'next';
import { withPublicReadDeadline } from '../../lib/publicReadDeadline';
import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/router';

import AdSlot from '../../src/components/ads/AdSlot';
import CategoryHeader from '../../src/components/category/CategoryHeader';
import { getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';
import { filterPubliclyPublishedArticles, getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from '../../lib/localizedArticleFields';
import { formatArticleBodyHtml, parseControlledFacebookBlock, parseControlledGalleryBlock, parseControlledInlineImageBlock, parseControlledInstagramBlock, parseControlledXBlock, parseControlledYouTubeBlock, splitArticleBodyBlocks, stripDuplicateOpeningParagraph, type ControlledArticleFacebookEmbed, type ControlledArticleGallery, type ControlledArticleInlineImage, type ControlledArticleInstagramEmbed, type ControlledArticleXEmbed, type ControlledArticleYouTubeEmbed } from '../../lib/articleBody';
import { fetchPublicNewsGroup, unwrapArticle, type Article } from '../../lib/publicNewsApi';
import { subscribePublicDataRefresh } from '../../lib/publicDataRefresh';
import { pickFreshestArticleForLocale, shouldReplaceArticleWithFreshCandidate } from '../../lib/translationGroupSync';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { tHeading, toLanguageKey } from '../../utils/localizedNames';
import { buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';
import { resolveSponsoredContentMeta } from '../../lib/sponsoredContent';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../../lib/storyIdentity';
import { formatEditorialDateTime } from '../../lib/storyDateTime';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import StoryImage, { ArticleHeroImage } from '../../src/components/story/StoryImage';
import EmbeddedMediaConsentGate from '../../src/consent/EmbeddedMediaConsentGate';
import { useArticleAnalytics } from '../../hooks/useArticleAnalytics';
import { hasRenderedTwitterWidgetFrame, loadTwitterWidgetsIn } from '../../lib/xWidgets';
import {
  getArticleAuthorDesignation,
  getArticleAuthorName,
  getArticleReadingTime,
  getEditorialTypeLabel,
  getImageAltText,
  getImageCaption,
  getImageCredit,
  getLocalizedSeoValue,
  getStoredSeoValue,
  isEditorialArticle,
} from '../../lib/editorialDisplay';
import {
  buildArticleSeoMetadata,
  getArticleAlternates,
  getArticleCanonicalUrl,
  resolvePublicSiteUrl,
  safeJsonLd,
} from '../../lib/seo';
import {
  getPulseDialogueFormatLabel,
  getPulseDialogueMetadata,
  resolvePulseDialogueDisclaimer,
  type PulseDialogueMetadata,
} from '../../lib/pulseDialogue';

type ArticleDisplayAdProps = {
  slotId: 'ARTICLE_INLINE' | 'ARTICLE_END';
};

function ArticleDisplayAd({ slotId }: ArticleDisplayAdProps) {
  const variant = slotId === 'ARTICLE_END' ? 'articleEnd' : 'articleInline';

  return (
    <div className="not-prose clear-both mx-auto my-7 w-full max-w-[336px]">
      <div className="mb-1 text-left">
        <span className="text-xs uppercase tracking-wide text-slate-500">ADVERTISEMENT</span>
      </div>
      <AdSlot slot={slotId} variant={variant} renderMode="articleDisplay" className="w-full" />
    </div>
  );
}

type ArticleInlineImageProps = {
  image: ControlledArticleInlineImage;
};

function formatVisiblePhotoCredit(value?: string): string {
  let credit = String(value || '').replace(/\s+/g, ' ').trim();
  while (/^(?:photo\s+credit|photo|credit)\s*:/i.test(credit)) {
    credit = credit.replace(/^(?:photo\s+credit|photo|credit)\s*:\s*/i, '').trim();
  }
  return credit ? `Photo: ${credit}` : '';
}

function formatVisibleCaption(value?: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function ArticleInlineImage({ image }: ArticleInlineImageProps) {
  const [failed, setFailed] = React.useState(false);
  const numericWidth = image.width ? Number(image.width) : undefined;
  const numericHeight = image.height ? Number(image.height) : undefined;
  const hasDimensions = Boolean(numericWidth && numericHeight);
  const frameStyle: React.CSSProperties | undefined = hasDimensions
    ? { aspectRatio: `${numericWidth} / ${numericHeight}` }
    : undefined;
  const visibleCaption = formatVisibleCaption(image.caption);
  const altText = image.alt || visibleCaption || 'News Pulse article image';
  const layout = image.layout === 'wide' || image.layout === 'full' ? image.layout : 'normal';
  const layoutClassName = `not-prose np-inline-image np-inline-image--${layout}`;
  const visibleCredit = formatVisiblePhotoCredit(image.credit);

  return (
    <figure className={layoutClassName} data-np-block="inline-image" data-np-media-id={image.mediaId || undefined} data-np-layout={layout}>
      <div className="np-inline-image__frame" style={frameStyle}>
        {failed ? (
          <div className="np-inline-image__fallback" role="img" aria-label={altText}>
            Image unavailable
          </div>
        ) : (
          <img
            className="np-inline-image__media"
            src={image.src}
            alt={altText}
            width={numericWidth}
            height={numericHeight}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {visibleCaption || visibleCredit ? (
        <figcaption className="np-inline-image__caption">
          {visibleCaption ? <span className="np-inline-image__caption-text">{visibleCaption}</span> : null}
          {visibleCredit ? <span className="np-inline-image__credit">{visibleCredit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

type ArticleGalleryImageProps = {
  image: ControlledArticleInlineImage;
  featured?: boolean;
  index?: number;
  onOpen?: (index: number, opener: HTMLButtonElement) => void;
  openLabel?: string;
};

function ArticleGalleryImage({ image, featured = false, index = 0, onOpen, openLabel }: ArticleGalleryImageProps) {
  const [failed, setFailed] = React.useState(false);
  const numericWidth = image.width ? Number(image.width) : undefined;
  const numericHeight = image.height ? Number(image.height) : undefined;
  const hasDimensions = Boolean(numericWidth && numericHeight);
  const frameStyle: React.CSSProperties | undefined = hasDimensions
    ? { aspectRatio: `${numericWidth} / ${numericHeight}` }
    : undefined;
  const visibleCaption = formatVisibleCaption(image.caption);
  const altText = image.alt || visibleCaption || 'News Pulse article gallery image';
  const visibleCredit = formatVisiblePhotoCredit(image.credit);

  return (
    <figure className={`np-gallery__item${featured ? ' np-gallery__item--featured' : ''}`} data-np-media-id={image.mediaId || undefined}>
      <button
        type="button"
        className="np-gallery__frame np-gallery__trigger"
        style={frameStyle}
        aria-label={openLabel || altText}
        onClick={(event) => onOpen?.(index, event.currentTarget)}
      >
        {failed ? (
          <div className="np-gallery__fallback" role="img" aria-label={altText}>
            Image unavailable
          </div>
        ) : (
          <img
            className="np-gallery__media"
            src={image.src}
            alt={altText}
            width={numericWidth}
            height={numericHeight}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </button>

      {visibleCaption || visibleCredit ? (
        <figcaption className="np-gallery__caption">
          {visibleCaption ? <span className="np-gallery__caption-text">{visibleCaption}</span> : null}
          {visibleCredit ? <span className="np-gallery__credit">{visibleCredit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

type ArticleGalleryProps = {
  gallery: ControlledArticleGallery;
  lang: 'en' | 'hi' | 'gu';
};

const GALLERY_LABELS: Record<'en' | 'hi' | 'gu', string> = {
  en: 'Photo Gallery',
  hi: 'फोटो गैलरी',
  gu: 'ફોટો ગેલેરી',
};

const GALLERY_LIGHTBOX_LABELS: Record<'en' | 'hi' | 'gu', { close: string; previous: string; next: string }> = {
  en: { close: 'Close', previous: 'Previous', next: 'Next' },
  hi: { close: 'बंद करें', previous: 'पिछला', next: 'अगला' },
  gu: { close: 'બંધ કરો', previous: 'પાછલું', next: 'આગળ' },
};

type ArticleGalleryLightboxProps = {
  images: ControlledArticleInlineImage[];
  activeIndex: number;
  lang: 'en' | 'hi' | 'gu';
  onClose: () => void;
  onSelectIndex: (index: number) => void;
};

function getFocusableDialogElements(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) return [];
  return Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

function ArticleGalleryLightbox({ images, activeIndex, lang, onClose, onSelectIndex }: ArticleGalleryLightboxProps) {
  const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const labels = GALLERY_LIGHTBOX_LABELS[lang] || GALLERY_LIGHTBOX_LABELS.en;
  const galleryLabel = GALLERY_LABELS[lang] || GALLERY_LABELS.en;
  const activeImage = images[activeIndex];
  const visibleCaption = formatVisibleCaption(activeImage?.caption);
  const visibleCredit = formatVisiblePhotoCredit(activeImage?.credit);
  const altText = activeImage?.alt || visibleCaption || 'News Pulse article gallery image';
  const imageKey = activeImage?.mediaId || activeImage?.src || String(activeIndex);
  const canGoPrevious = activeIndex > 0;
  const canGoNext = activeIndex < images.length - 1;

  React.useEffect(() => {
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    closeButtonRef.current?.focus();

    return () => {
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (canGoPrevious) onSelectIndex(activeIndex - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (canGoNext) onSelectIndex(activeIndex + 1);
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = getFocusableDialogElements(dialogRef.current);
        if (!focusableElements.length) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, canGoNext, canGoPrevious, onClose, onSelectIndex]);

  if (!activeImage) return null;

  return (
    <div
      ref={dialogRef}
      className="np-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${galleryLabel} ${activeIndex + 1} / ${images.length}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="np-gallery-lightbox__panel">
        <div className="np-gallery-lightbox__header">
          <div className="np-gallery-lightbox__title">{galleryLabel}</div>
          <div className="np-gallery-lightbox__count">{activeIndex + 1} / {images.length}</div>
          <button ref={closeButtonRef} type="button" className="np-gallery-lightbox__close" aria-label={labels.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="np-gallery-lightbox__stage">
          <button type="button" className="np-gallery-lightbox__nav np-gallery-lightbox__nav--previous" aria-label={labels.previous} onClick={() => canGoPrevious && onSelectIndex(activeIndex - 1)} disabled={!canGoPrevious}>
            ‹
          </button>

          <figure className="np-gallery-lightbox__figure">
            <div className="np-gallery-lightbox__media-frame">
              {failedImages[imageKey] ? (
                <div className="np-gallery-lightbox__fallback" role="img" aria-label={altText}>
                  Image unavailable
                </div>
              ) : (
                <img
                  className="np-gallery-lightbox__media"
                  src={activeImage.src}
                  alt={altText}
                  width={numericWidthFromImage(activeImage)}
                  height={numericHeightFromImage(activeImage)}
                  loading="eager"
                  decoding="async"
                  onError={() => setFailedImages((current) => ({ ...current, [imageKey]: true }))}
                />
              )}
            </div>
            {visibleCaption || visibleCredit ? (
              <figcaption className="np-gallery-lightbox__caption">
                {visibleCaption ? <span className="np-gallery-lightbox__caption-text">{visibleCaption}</span> : null}
                {visibleCredit ? <span className="np-gallery-lightbox__credit">{visibleCredit}</span> : null}
              </figcaption>
            ) : null}
          </figure>

          <button type="button" className="np-gallery-lightbox__nav np-gallery-lightbox__nav--next" aria-label={labels.next} onClick={() => canGoNext && onSelectIndex(activeIndex + 1)} disabled={!canGoNext}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

function numericWidthFromImage(image: ControlledArticleInlineImage): number | undefined {
  return image.width ? Number(image.width) : undefined;
}

function numericHeightFromImage(image: ControlledArticleInlineImage): number | undefined {
  return image.height ? Number(image.height) : undefined;
}

export function ArticleGallery({ gallery, lang }: ArticleGalleryProps) {
  const images = Array.isArray(gallery.images) ? gallery.images : [];
  const [activeLightboxIndex, setActiveLightboxIndex] = React.useState<number | null>(null);
  const openerRef = React.useRef<HTMLButtonElement | null>(null);

  const closeLightbox = React.useCallback(() => {
    setActiveLightboxIndex(null);
    openerRef.current?.focus();
  }, []);

  const openLightbox = React.useCallback((index: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setActiveLightboxIndex(index);
  }, []);

  if (images.length < 2 || images.length > 20) return null;

  const headingId = `article-gallery-${images.map((image) => image.mediaId || image.src).join('-')}`.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 96);
  const galleryLabel = GALLERY_LABELS[lang] || GALLERY_LABELS.en;

  return (
    <section className="not-prose np-gallery" data-np-block="gallery" aria-labelledby={headingId}>
      <h2 id={headingId} className="np-gallery__heading">{galleryLabel}</h2>
      <ArticleGalleryImage image={images[0]} featured index={0} onOpen={openLightbox} openLabel={`${galleryLabel}: ${images[0]?.alt || images[0]?.caption || 'Open image'} 1 / ${images.length}`} />
      {images.length > 1 ? (
        <div className="np-gallery__grid np-gallery__grid--responsive">
          {images.slice(1).map((image, index) => (
            <ArticleGalleryImage key={image.mediaId || image.src} image={image} index={index + 1} onOpen={openLightbox} openLabel={`${galleryLabel}: ${image.alt || image.caption || 'Open image'} ${index + 2} / ${images.length}`} />
          ))}
        </div>
      ) : null}
      {activeLightboxIndex !== null ? <ArticleGalleryLightbox images={images} activeIndex={activeLightboxIndex} lang={lang} onClose={closeLightbox} onSelectIndex={setActiveLightboxIndex} /> : null}
    </section>
  );
}

type ArticleYouTubeEmbedProps = {
  embed: ControlledArticleYouTubeEmbed;
};

export function ArticleYouTubeEmbed({ embed }: ArticleYouTubeEmbedProps) {
  const [failed, setFailed] = React.useState(false);

  return (
    <figure className="not-prose np-youtube-embed" data-np-block="youtube" data-np-video-id={embed.videoId}>
      <div className="np-youtube-embed__frame" style={{ aspectRatio: '16 / 9' }}>
        {failed ? (
          <div className="np-youtube-embed__fallback" role="note">
            <span>Video unavailable</span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
          </div>
        ) : (
          <EmbeddedMediaConsentGate title="YouTube video" className="absolute inset-0" placeholderClassName="rounded-lg">
            <iframe
              className="np-youtube-embed__iframe"
              title="YouTube video"
              src={embed.embedUrl}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setFailed(true)}
            />
          </EmbeddedMediaConsentGate>
        )}
      </div>
    </figure>
  );
}

type ArticleXEmbedProps = {
  embed: ControlledArticleXEmbed;
};

function ArticleXEmbedFrame({ embed, onFailed, onLoaded }: ArticleXEmbedProps & { onFailed: () => void; onLoaded: () => void }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!embed.url || typeof window === 'undefined') return;

    let cancelled = false;
    let timerId: number | undefined;

    const markFailed = () => {
      if (!cancelled) onFailed();
    };

    loadTwitterWidgetsIn(containerRef.current).then(() => {
      if (cancelled) return;
      onLoaded();
      timerId = window.setTimeout(() => {
        if (cancelled) return;
        if (!hasRenderedTwitterWidgetFrame(containerRef.current)) markFailed();
      }, 7000);
    }).catch(markFailed);

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [embed.postId, embed.url, onFailed, onLoaded]);

  return (
    <div ref={containerRef} className="np-x-embed__container">
      <blockquote className="twitter-tweet np-x-embed__tweet" data-dnt="true" data-conversation="none">
        <a href={embed.url}></a>
      </blockquote>
    </div>
  );
}

export function ArticleXEmbed({ embed }: ArticleXEmbedProps) {
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setFailed(false);
    setLoading(true);
  }, [embed.postId, embed.url]);

  const markFailed = React.useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  const markLoaded = React.useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <figure className="not-prose np-x-embed" data-np-block="x" data-np-post-id={embed.postId}>
      <div className="np-x-embed__frame">
        {failed ? (
          <div className="np-x-embed__fallback" role="note">
            <span>X post unavailable</span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              Open on X
            </a>
          </div>
        ) : (
          <EmbeddedMediaConsentGate title="X post" className="np-x-embed__consent" placeholderClassName="rounded-lg">
            <div className="np-x-embed__loader-shell">
              <ArticleXEmbedFrame embed={embed} onFailed={markFailed} onLoaded={markLoaded} />
              {loading ? <div className="np-x-embed__loading" role="status">Loading X post...</div> : null}
            </div>
          </EmbeddedMediaConsentGate>
        )}
      </div>
    </figure>
  );
}

type ArticleInstagramEmbedProps = {
  embed: ControlledArticleInstagramEmbed;
};

function ArticleInstagramEmbedFrame({ embed, onFailed }: ArticleInstagramEmbedProps & { onFailed: () => void }) {
  const timerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    timerRef.current = window.setTimeout(onFailed, 12000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [embed.embedUrl, onFailed]);

  return (
    <iframe
      className="np-instagram-embed__iframe"
      title="Instagram post"
      src={embed.embedUrl}
      loading="lazy"
      allow="encrypted-media; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      }}
      onError={onFailed}
    />
  );
}

export function ArticleInstagramEmbed({ embed }: ArticleInstagramEmbedProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [embed.embedUrl, embed.url]);

  const markFailed = React.useCallback(() => {
    setFailed(true);
  }, []);

  return (
    <figure className="not-prose np-instagram-embed" data-np-block="instagram" data-np-shortcode={embed.shortcode}>
      <div className="np-instagram-embed__frame">
        {failed ? (
          <div className="np-instagram-embed__fallback" role="note">
            <span>Instagram post unavailable</span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              Open on Instagram
            </a>
          </div>
        ) : (
          <EmbeddedMediaConsentGate title="Instagram post" className="np-instagram-embed__consent" placeholderClassName="rounded-lg">
            <ArticleInstagramEmbedFrame embed={embed} onFailed={markFailed} />
          </EmbeddedMediaConsentGate>
        )}
      </div>
    </figure>
  );
}

type ArticleFacebookEmbedProps = {
  embed: ControlledArticleFacebookEmbed;
};

function ArticleFacebookEmbedFrame({ embed, onFailed }: ArticleFacebookEmbedProps & { onFailed: () => void }) {
  const timerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    timerRef.current = window.setTimeout(onFailed, 12000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [embed.embedUrl, onFailed]);

  return (
    <iframe
      className="np-facebook-embed__iframe"
      title="Facebook post"
      src={embed.embedUrl}
      loading="lazy"
      allow="encrypted-media; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      }}
      onError={onFailed}
    />
  );
}

export function ArticleFacebookEmbed({ embed }: ArticleFacebookEmbedProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [embed.embedUrl, embed.url]);

  const markFailed = React.useCallback(() => {
    setFailed(true);
  }, []);

  return (
    <figure className="not-prose np-facebook-embed" data-np-block="facebook">
      <div className="np-facebook-embed__frame">
        {failed ? (
          <div className="np-facebook-embed__fallback" role="note">
            <span>Facebook post unavailable</span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              Open on Facebook
            </a>
          </div>
        ) : (
          <EmbeddedMediaConsentGate title="Facebook post" className="np-facebook-embed__consent" placeholderClassName="rounded-lg">
            <ArticleFacebookEmbedFrame embed={embed} onFailed={markFailed} />
          </EmbeddedMediaConsentGate>
        )}
      </div>
    </figure>
  );
}

function ArticleReadingSidebar() {
  return (
    <div className="sticky top-4 grid w-full min-w-0 gap-4">
      <AdSlot slot="HOME_RIGHT_300x250" variant="right300" />
    </div>
  );
}

function sanitizeContent(html: string) {
  return formatArticleBodyHtml(html || '');
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRouteLocale(value: unknown): RouteLocale {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  return 'en';
}

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  if (base === 'en' || base === 'english') return 'en';
  return 'en';
}

function stripQueryHash(path: string): string {
  const raw = String(path || '/');
  const noHash = raw.split('#')[0] || '/';
  const noQuery = noHash.split('?')[0] || '/';
  return noQuery || '/';
}

function localePrefix(lang: 'en' | 'hi' | 'gu'): '' | '/hi' | '/gu' {
  return lang === 'en' ? '' : (lang === 'hi' ? '/hi' : '/gu');
}

function tagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').toLowerCase().trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => String(t || '').toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

function slugifyTopic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function resolveCategoryKey(article: Article | null): string {
  const raw = String((article as any)?.category || '').trim().toLowerCase();
  if (!raw) return '';
  return getCategoryRouteKey(raw);
}

function resolveCategoryQueryKey(article: Article | null): string {
  const raw = String((article as any)?.category || '').trim().toLowerCase();
  if (!raw) return '';
  return getCategoryQueryKey(raw);
}

function categoryLabelFromKey(key: string): string {
  if (!key) return 'News';
  if (key === 'science-technology') return 'Science & Technology';
  return key
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

type Props = {
  messages: any;
  locale: string;
  lang: 'en' | 'hi' | 'gu';
  slug: string;
  article: Article | null;
  safeHtml: string;
  topStories: Article[];
  relatedStories: Article[];
  error?: string | null;
  pending?: boolean;
  pendingSourceLang?: 'en' | 'hi' | 'gu' | null;
  siteUrl: string;
  seo?: {
    canonicalUrl?: string;
    alternates?: Array<{ hrefLang: string; href: string }>;
  };
};

const LANG_LABELS: Record<'en' | 'hi' | 'gu', string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

function isPendingTranslationPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const direct = String((payload as any).status || (payload as any).translationStatus || (payload as any).state || '').toLowerCase();
  if (direct === 'pending' || direct === 'translating') return true;

  const nested = (payload as any).data && typeof (payload as any).data === 'object' ? (payload as any).data : null;
  if (!nested) return false;
  const nestedStatus = String((nested as any).status || (nested as any).translationStatus || (nested as any).state || '').toLowerCase();
  return nestedStatus === 'pending' || nestedStatus === 'translating';
}

function getPendingSourceLang(payload: any): 'en' | 'hi' | 'gu' | null {
  const candidates = [
    payload?.sourceLang,
    payload?.sourceLanguage,
    payload?.availableLang,
    payload?.availableLanguage,
    payload?.data?.sourceLang,
    payload?.data?.sourceLanguage,
    payload?.data?.availableLang,
    payload?.data?.availableLanguage,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    return normalizeLang(candidate);
  }
  return null;
}

function getArticleSourceLang(article: Article | null): 'en' | 'hi' | 'gu' | null {
  if (!article) return null;
  const raw = (article as any)?.sourceLang || (article as any)?.sourceLanguage || (article as any)?.language || (article as any)?.lang;
  return raw ? normalizeLang(raw) : null;
}

/** Renders a real link only when the related story resolves to a route, never a dead '#'. */
function RelatedStoryShell({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!isNavigableNewsHref(href)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function PulseDialogueArticleByline({ metadata, byLabel }: { metadata: PulseDialogueMetadata; byLabel: string }) {
  const [photoFailed, setPhotoFailed] = React.useState(false);

  React.useEffect(() => {
    setPhotoFailed(false);
  }, [metadata.contributorPhotoUrl]);

  const showPhoto = Boolean(metadata.contributorPhotoUrl && !photoFailed);

  if (!metadata.contributorName && !showPhoto) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm text-slate-800">
      {showPhoto ? (
        <img
          src={metadata.contributorPhotoUrl}
          alt={metadata.contributorPhotoAlt || metadata.contributorName || 'Contributor'}
          className="h-12 w-12 shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover"
          loading="lazy"
          onError={() => setPhotoFailed(true)}
        />
      ) : null}
      <div className="min-w-0">
        {metadata.contributorName ? (
          <div className="font-bold text-slate-900">{byLabel} {metadata.contributorName}</div>
        ) : null}
        {metadata.contributorDesignation ? <div className="text-slate-600">{metadata.contributorDesignation}</div> : null}
        {metadata.contributorAffiliation ? <div className="text-slate-600">{metadata.contributorAffiliation}</div> : null}
      </div>
    </div>
  );
}

function PulseDialogueInfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <section className="not-prose rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-slate-800">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-newsPulse-blue">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function PulseDialogueArticleExtras({ metadata, t }: { metadata: PulseDialogueMetadata; t: (key: string) => string }) {
  const disclaimer = resolvePulseDialogueDisclaimer(metadata.contributorDisclaimer, t);
  const showAbout = Boolean(metadata.showAboutContributor && (metadata.contributorName || metadata.contributorShortBio));

  if (!metadata.contributorDisclosure && !metadata.editorNote && !disclaimer && !showAbout) return null;

  return (
    <div className="grid gap-3">
      {metadata.contributorDisclosure ? (
        <PulseDialogueInfoBlock label={t('pulseDialogue.article.contributorDisclosure')}>
          {metadata.contributorDisclosure}
        </PulseDialogueInfoBlock>
      ) : null}

      {metadata.editorNote ? (
        <PulseDialogueInfoBlock label={t('pulseDialogue.article.editorNote')}>
          {metadata.editorNote}
        </PulseDialogueInfoBlock>
      ) : null}

      {disclaimer ? (
        <PulseDialogueInfoBlock label={t('pulseDialogue.article.contributorDisclaimer')}>
          {disclaimer}
        </PulseDialogueInfoBlock>
      ) : null}

      {showAbout ? (
        <PulseDialogueInfoBlock label={t('pulseDialogue.article.aboutContributor')}>
          {metadata.contributorName ? <div className="font-bold text-slate-900">{metadata.contributorName}</div> : null}
          {metadata.contributorShortBio ? <div className={metadata.contributorName ? 'mt-1' : ''}>{metadata.contributorShortBio}</div> : null}
        </PulseDialogueInfoBlock>
      ) : null}
    </div>
  );
}

function debugNewsDetailResolution(stage: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[pages/news/[slug]]', { stage, ...payload });
}

export default function NewsSlugDetailPage({ lang, slug, article, safeHtml, relatedStories, error, pending, pendingSourceLang = null, siteUrl }: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const [resolvedArticle, setResolvedArticle] = React.useState<Article | null>(article);
  const [resolvedSafeHtml, setResolvedSafeHtml] = React.useState<string>(safeHtml || '');
  const [pendingTranslate, setPendingTranslate] = React.useState<boolean>(Boolean(pending));
  const [pendingError, setPendingError] = React.useState<string | null>(error || null);
  const [pendingExhausted, setPendingExhausted] = React.useState<boolean>(false);
  const pendingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAttemptsRef = React.useRef<number>(0);

  const routeLocale = React.useMemo(() => toRouteLocale(lang), [lang]);
  const localized = React.useMemo(
    () => getLocalizedArticleFields(resolvedArticle || {}, routeLocale, STRICT_LOCALE_POLICY),
    [resolvedArticle, routeLocale]
  );
  const rawTitle = cleanText(localized.title);
  const displayTitle = rawTitle.length > 180 ? `${rawTitle.slice(0, 177).trimEnd()}…` : rawTitle;
  const displaySummary = cleanText(localized.summary);

  const clearPendingTimer = React.useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const refreshFromTranslationGroup = React.useCallback(async () => {
    const current = resolvedArticle;
    const translationGroupId = String((current as any)?.translationGroupId || '').trim();
    if (!translationGroupId) return;

    const group = await fetchPublicNewsGroup({ translationGroupId, language: lang });
    if (group.error || !Array.isArray(group.items) || !group.items.length) return;

    const freshest = pickFreshestArticleForLocale({
      currentArticle: current,
      groupArticles: group.items,
      locale: toRouteLocale(lang),
      policy: STRICT_LOCALE_POLICY,
    });
    if (!shouldReplaceArticleWithFreshCandidate(current, freshest, toRouteLocale(lang))) return;

    const localizedFreshest = getLocalizedArticleFields(freshest || {}, lang, STRICT_LOCALE_POLICY);
    if (!localizedFreshest.isVisible) return;

    setResolvedArticle(freshest as Article);
    setResolvedSafeHtml(sanitizeContent(localizedFreshest.bodyHtml || ''));
  }, [lang, resolvedArticle]);

  const schedulePendingRetry = React.useCallback(
    (pollOnce: () => Promise<void>) => {
      clearPendingTimer();
      pendingTimerRef.current = setTimeout(() => {
        void pollOnce();
      }, 1500);
    },
    [clearPendingTimer]
  );

  const pollOnce = React.useCallback(async () => {
    const slugToUse = String((router.query as any)?.slug || slug || '').trim();
    if (!slugToUse) return;

    if (pendingAttemptsRef.current >= 10) {
      setPendingExhausted(true);
      return;
    }

    pendingAttemptsRef.current += 1;

    const params = new URLSearchParams();
    params.set('lang', lang);
    params.set('language', lang);
    const endpoint = `/api/public/news/${encodeURIComponent(slugToUse)}?${params.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (isPendingTranslationPayload(json)) {
        setPendingTranslate(true);
        schedulePendingRetry(pollOnce);
        return;
      }

      const next = unwrapArticle(json);
      if (!next?._id) {
        setPendingTranslate(false);
        setPendingError('Try again');
        setPendingExhausted(true);
        return;
      }

      const localizedNext = getLocalizedArticleFields(next || {}, lang, STRICT_LOCALE_POLICY);
      if (!localizedNext.isVisible) {
        setPendingTranslate(false);
        setPendingError('Not found');
        setPendingExhausted(true);
        return;
      }

      const html = localizedNext.bodyHtml;
      setResolvedArticle(next);
      setResolvedSafeHtml(sanitizeContent(html));
      setPendingTranslate(false);
      setPendingError(null);
      setPendingExhausted(false);
      pendingAttemptsRef.current = 0;
      clearPendingTimer();
    } catch {
      setPendingTranslate(false);
      setPendingError('Try again');
      setPendingExhausted(true);
    }
  }, [clearPendingTimer, lang, router.query, schedulePendingRetry, slug]);

  React.useEffect(() => {
    // When SSR says we're pending translation, start the polling loop.
    if (resolvedArticle?._id) return;
    if (!pendingTranslate) return;
    if (pendingExhausted) return;
    if (pendingTimerRef.current) return;
    schedulePendingRetry(pollOnce);
    return () => clearPendingTimer();
  }, [clearPendingTimer, pendingExhausted, pendingTranslate, pollOnce, resolvedArticle, schedulePendingRetry]);

  React.useEffect(() => {
    // If navigation changes to a different slug or language, reset pending state.
    setResolvedArticle(article);
    setResolvedSafeHtml(safeHtml || '');
    setPendingError(error || null);
    setPendingTranslate(Boolean(pending));
    setPendingExhausted(false);
    pendingAttemptsRef.current = 0;
    clearPendingTimer();
  }, [article, clearPendingTimer, error, lang, pending, safeHtml, slug]);

  React.useEffect(() => {
    if (!resolvedArticle?._id) return;

    // SSR already delivered the freshest article for this locale, so only re-sync
    // when a publish actually happens instead of refetching on every mount.
    return subscribePublicDataRefresh(() => {
      void refreshFromTranslationGroup();
    });
  }, [refreshFromTranslationGroup, resolvedArticle?._id]);

  const articleBodyHtml = React.useMemo(
    () => stripDuplicateOpeningParagraph(resolvedSafeHtml, displaySummary),
    [displaySummary, resolvedSafeHtml]
  );

  const paragraphBlocks = React.useMemo(() => splitArticleBodyBlocks(articleBodyHtml), [articleBodyHtml]);

  const inlineInsertAfterIndex = React.useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < paragraphBlocks.length; i += 1) {
      const b = String(paragraphBlocks[i] || '').trim();
      if (/^<p\b/i.test(b)) indices.push(i);
    }
    if (!indices.length) return null;
    if (indices.length >= 3) return indices[2];
    return indices[0];
  }, [paragraphBlocks]);

  const tx = React.useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key);
        if (!v) return fallback;
        if (v === key) return fallback;
        return v;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const resolvedSlug = React.useMemo(
    () => String(localized.slug || resolvedArticle?._id || slug || '').trim(),
    [localized.slug, resolvedArticle?._id, slug]
  );

  React.useEffect(() => {
    debugNewsDetailResolution('client', {
      locale: lang,
      receivedSlug: slug,
      resolvedSlug: resolvedSlug || null,
      articleId: String(resolvedArticle?._id || '').trim() || null,
      translationFound: localized.translationFound,
    });
  }, [lang, localized.translationFound, resolvedArticle?._id, resolvedSlug, slug]);

  const analyticsSlug = React.useMemo(() => {
    const id = String(resolvedArticle?._id || '').trim();
    return String(localized.slug || id || slug || '').trim();
  }, [localized.slug, resolvedArticle?._id, slug]);

  useArticleAnalytics({
    article: resolvedArticle,
    slug: analyticsSlug,
    lang,
    isPendingTranslation: pendingTranslate,
  });

  const displayProvider = cleanText((resolvedArticle as any)?.provider);
  const displayGeneratedAt = cleanText((resolvedArticle as any)?.generatedAt);

  const heroSrc = resolveCoverImageUrl(resolvedArticle, { lang }) || null;
  const sponsoredMeta = React.useMemo(() => resolveSponsoredContentMeta(resolvedArticle, lang), [lang, resolvedArticle]);

  const prefix = React.useMemo(() => localePrefix(lang), [lang]);
  const categoryKey = React.useMemo(() => resolveCategoryKey(resolvedArticle), [resolvedArticle]);
  const categoryLabel = React.useMemo(() => categoryLabelFromKey(categoryKey), [categoryKey]);
  const displayCategoryLabel = React.useMemo(() => cleanText(localized.categoryLabel) || categoryLabel, [categoryLabel, localized.categoryLabel]);
  const editorialLabel = React.useMemo(() => (isEditorialArticle(resolvedArticle) ? getEditorialTypeLabel(resolvedArticle) : ''), [resolvedArticle]);
  const pulseDialogueMetadata = React.useMemo(() => getPulseDialogueMetadata(resolvedArticle), [resolvedArticle]);
  const pulseDialogueFormatLabel = React.useMemo(
    () => pulseDialogueMetadata ? getPulseDialogueFormatLabel(pulseDialogueMetadata.dialogueFormat, t) : '',
    [pulseDialogueMetadata, t]
  );
  const isPulseDialogueDetail = categoryKey === 'pulse-dialogue' || Boolean(pulseDialogueMetadata);
  const authorName = React.useMemo(() => getArticleAuthorName(resolvedArticle), [resolvedArticle]);
  const authorDesignation = React.useMemo(() => getArticleAuthorDesignation(resolvedArticle), [resolvedArticle]);
  const visibleAuthorName = isPulseDialogueDetail ? (pulseDialogueMetadata?.contributorName || '') : authorName;
  const visibleAuthorDesignation = isPulseDialogueDetail ? (pulseDialogueMetadata?.contributorDesignation || '') : authorDesignation;
  const pulseReadingTime = React.useMemo(() => pulseDialogueMetadata ? getArticleReadingTime(resolvedArticle) : '', [pulseDialogueMetadata, resolvedArticle]);
  const imageCaption = React.useMemo(() => getImageCaption(resolvedArticle, lang), [lang, resolvedArticle]);
  const imageCredit = React.useMemo(() => getImageCredit(resolvedArticle, lang), [lang, resolvedArticle]);
  const imageAltText = React.useMemo(() => cleanText(getImageAltText(resolvedArticle, lang)) || displayTitle, [displayTitle, lang, resolvedArticle]);
  const publishedDate = React.useMemo(() => cleanText((resolvedArticle as any)?.publishedAt), [resolvedArticle]);
  const updatedDate = React.useMemo(() => {
    const raw = cleanText((resolvedArticle as any)?.updatedAt || (resolvedArticle as any)?.modifiedAt);
    if (!raw || raw === publishedDate) return '';
    return raw;
  }, [publishedDate, resolvedArticle]);

  const homeHref = React.useMemo(() => (prefix ? prefix : '/'), [prefix]);
  const categoryHref = React.useMemo(() => (categoryKey ? `${prefix}/${categoryKey}`.replace(/\/\//g, '/') : ''), [categoryKey, prefix]);
  const sourceLang = React.useMemo(() => getArticleSourceLang(resolvedArticle) || pendingSourceLang || 'en', [pendingSourceLang, resolvedArticle]);
  const pendingSourceHref = React.useMemo(() => {
    const id = String((resolvedArticle as any)?._id || slug || '').trim();
    return buildNewsUrl({ id, slug: id, lang: sourceLang });
  }, [resolvedArticle, slug, sourceLang]);

  const categoryHeaderTitle = React.useMemo(() => {
    const langKey = toLanguageKey(lang);
    if (!categoryKey) return displayCategoryLabel;
    try {
      const out = tHeading(langKey as any, categoryKey as any);
      const text = String(out || '').trim();
      return text || displayCategoryLabel;
    } catch {
      return displayCategoryLabel;
    }
  }, [categoryKey, displayCategoryLabel]);

  const categoryHeaderSubtitle = React.useMemo(() => {
    // Keep it compact; use i18n if present, else plain English.
    if (categoryKey === 'national') return tx('nationalPage.newsFeed', 'News Feed');
    return 'News Feed';
  }, [categoryKey, tx]);

  const categorySearchPlaceholder = React.useMemo(() => {
    if (categoryKey === 'national') return tx('nationalPage.searchPlaceholder', 'Search National news…');
    if (categoryKey) return `Search ${categoryHeaderTitle}…`;
    return 'Search news…';
  }, [categoryHeaderTitle, categoryKey, tx]);

  const canonicalUrl = React.useMemo(() => {
    return getArticleCanonicalUrl(resolvedArticle, lang, siteUrl);
  }, [lang, resolvedArticle, siteUrl]);
  const seoTitle = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'pageTitle', 'seoTitle', 'metaTitle', 'ogTitle', 'openGraphTitle', 'title') || displayTitle, [displayTitle, lang, resolvedArticle]);
  const seoDescription = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'metaDescription', 'seoDescription', 'ogDescription', 'openGraphDescription', 'socialDescription', 'description') || displaySummary, [displaySummary, lang, resolvedArticle]);
  const ogTitle = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogTitle', 'openGraphTitle') || seoTitle || displayTitle, [displayTitle, lang, resolvedArticle, seoTitle]);
  const ogDescription = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogDescription', 'openGraphDescription', 'socialDescription') || seoDescription, [lang, resolvedArticle, seoDescription]);
  const ogImage = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogImage', 'openGraphImage', 'image') || heroSrc || '', [heroSrc, lang, resolvedArticle]);
  const articleSeo = React.useMemo(() => buildArticleSeoMetadata(resolvedArticle, lang, siteUrl), [lang, resolvedArticle, siteUrl]);

  const shareThis = async () => {
    const url = canonicalUrl || (typeof window !== 'undefined' ? stripQueryHash(window.location.href) : '');
    const shareTitle = String(displayTitle || 'News Pulse').trim();
    if (!url) return;

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
        if (typeof nav.share === 'function') {
          await nav.share({ title: shareTitle, url });
          return;
        }
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const articleTitleParts = React.useMemo(() => splitStoryTitleHook(displayTitle), [displayTitle]);
  const articleTitleHookColor = React.useMemo(
    () => getStoryTitleHookColor(displayCategoryLabel || (resolvedArticle as any)?.category || (resolvedArticle as any)?.section),
    [displayCategoryLabel, resolvedArticle]
  );

  return (
    <>
      <Head>
        <title>{`${(pendingTranslate && !displayTitle) ? 'Translating…' : (articleSeo?.title || seoTitle || displayTitle || 'News')} | News Pulse`}</title>
        {articleSeo?.description || seoDescription ? <meta name="description" content={articleSeo?.description || seoDescription} /> : null}
        {articleSeo?.robots ? <meta name="robots" content={articleSeo.robots} /> : null}
        <meta property="og:type" content="article" />
        {articleSeo?.ogTitle || ogTitle ? <meta property="og:title" content={articleSeo?.ogTitle || ogTitle} /> : null}
        {articleSeo?.ogDescription || ogDescription ? <meta property="og:description" content={articleSeo?.ogDescription || ogDescription} /> : null}
        {articleSeo?.ogUrl || canonicalUrl ? <meta property="og:url" content={articleSeo?.ogUrl || canonicalUrl} /> : null}
        {articleSeo?.ogImage || ogImage ? <meta property="og:image" content={articleSeo?.ogImage || ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        {articleSeo?.twitterTitle ? <meta name="twitter:title" content={articleSeo.twitterTitle} /> : null}
        {articleSeo?.twitterDescription ? <meta name="twitter:description" content={articleSeo.twitterDescription} /> : null}
        {articleSeo?.twitterImage ? <meta name="twitter:image" content={articleSeo.twitterImage} /> : null}
        {publishedDate ? <meta property="article:published_time" content={publishedDate} /> : null}
        {updatedDate ? <meta property="article:modified_time" content={updatedDate} /> : null}
        {visibleAuthorName ? <meta name="author" content={visibleAuthorName} /> : null}
        {articleSeo?.newsArticleJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSeo.newsArticleJsonLd) }} /> : null}
        {articleSeo?.breadcrumbJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSeo.breadcrumbJsonLd) }} /> : null}
      </Head>

      <main className="min-h-screen bg-white">
        <CategoryHeader
          categorySlug={categoryKey || 'news'}
          title={categoryHeaderTitle}
          subtitle={categoryHeaderSubtitle}
          langPrefix={prefix as '' | '/hi' | '/gu' | '/en'}
          variant="compact"
          showBrowseStates={categoryKey === 'national'}
          browseStatesLabel={tx('nationalPage.browseStates', 'Browse states →')}
          showSearch
          searchPlaceholder={categorySearchPlaceholder}
        />

        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main */}
            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 md:px-6 pt-4 md:pt-5 pb-4">
                  {/* Breadcrumbs */}
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <a href={homeHref} className="hover:underline">{tx('common.home', 'Home')}</a>
                    <span className="text-slate-300">›</span>
                    {categoryKey ? (
                      <a href={categoryHref} className="hover:underline">{displayCategoryLabel}</a>
                    ) : (
                      <span>{displayCategoryLabel}</span>
                    )}
                    {(() => {
                      const state = String((resolvedArticle as any)?.state || (resolvedArticle as any)?.region || '').trim();
                      const district = String((resolvedArticle as any)?.district || '').trim();
                      if (!state && !district) return null;
                      return (
                        <>
                          <span className="text-slate-300">›</span>
                          <span className="truncate max-w-[55vw]">{[state, district].filter(Boolean).join(' • ')}</span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    {editorialLabel ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-newsPulse-blue/20 bg-newsPulse-blue/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-newsPulse-blue">
                          {editorialLabel}
                        </span>
                      </div>
                    ) : null}

                    {pulseDialogueMetadata ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-newsPulse-blue/20 bg-newsPulse-blue/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-newsPulse-blue">
                          {tx('categories.pulseDialogue', 'Pulse Dialogue')}
                        </span>
                        {pulseDialogueFormatLabel ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700">
                            {pulseDialogueFormatLabel}
                          </span>
                        ) : null}
                        {pulseDialogueMetadata.series ? (
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {pulseDialogueMetadata.series}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {sponsoredMeta.isArticle ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
                          Sponsored
                        </span>
                        {sponsoredMeta.sponsorName ? (
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Presented with {sponsoredMeta.sponsorName}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                      {articleTitleParts.highlightedHook ? <span style={{ color: articleTitleHookColor }}>{articleTitleParts.highlightedHook}</span> : null}
                      {articleTitleParts.remainingTitle ? <span>{` ${articleTitleParts.remainingTitle}`}</span> : null}
                    </h1>

                    {pendingError ? <div className="text-sm text-red-600">{pendingError}</div> : null}

                    {pendingTranslate ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                        <span>{`This article is being prepared in ${LANG_LABELS[lang]}.`}</span>
                        {sourceLang !== lang ? (
                          <a href={pendingSourceHref} className="underline underline-offset-2 hover:text-slate-900">
                            {`Read in ${LANG_LABELS[sourceLang]}`}
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {pendingExhausted ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingError(null);
                            setPendingExhausted(false);
                            pendingAttemptsRef.current = 0;
                            setPendingTranslate(true);
                            clearPendingTimer();
                            void pollOnce();
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="min-w-0 text-xs font-semibold text-slate-500">
                        {pulseDialogueMetadata ? (
                          <PulseDialogueArticleByline metadata={pulseDialogueMetadata} byLabel={t('pulseDialogue.article.by')} />
                        ) : visibleAuthorName ? (
                          <div className="text-sm text-slate-800">
                            <span className="font-bold">By {visibleAuthorName}</span>
                            {visibleAuthorDesignation ? <span className="text-slate-500">, {visibleAuthorDesignation}</span> : null}
                          </div>
                        ) : null}
                        <div className={visibleAuthorName || pulseDialogueMetadata?.contributorPhotoUrl ? 'mt-1' : ''}>
                          {publishedDate ? <span>Published {formatEditorialDateTime(publishedDate)}</span> : null}
                          {publishedDate && updatedDate ? ' • ' : null}
                          {updatedDate ? <span>Updated {formatEditorialDateTime(updatedDate)}</span> : null}
                          {(publishedDate || updatedDate) && (displayProvider || displayGeneratedAt) ? ' • ' : null}
                          {displayProvider ? displayProvider : null}
                          {displayProvider && displayGeneratedAt ? ' • ' : null}
                          {displayGeneratedAt ? displayGeneratedAt : null}
                          {(publishedDate || updatedDate || displayProvider || displayGeneratedAt) && pulseReadingTime ? ' • ' : null}
                          {pulseReadingTime ? <span>{pulseReadingTime}</span> : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={shareThis}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {tx('common.share', 'Share')}
                      </button>

                    </div>

                    {Array.isArray((resolvedArticle as any)?.tags) && (resolvedArticle as any)?.tags?.length ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {tagList((resolvedArticle as any)?.tags)
                          .slice(0, 6)
                          .map((tag) => (
                            <a
                              key={tag}
                              href={`${prefix}/topic/${encodeURIComponent(slugifyTopic(tag))}?q=${encodeURIComponent(tag)}`.replace(/\/\//g, '/')}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              #{tag}
                            </a>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="px-4 md:px-6 pb-5">
                  <ArticleHeroImage
                    storyId={getStoryId(resolvedArticle)}
                    src={heroSrc}
                    fallbackSrc={COVER_PLACEHOLDER_SRC}
                    alt={imageAltText}
                    priority
                  />

                  {imageCaption || imageCredit ? (
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      {imageCaption ? <span>{imageCaption}</span> : null}
                      {imageCaption && imageCredit ? <span> • </span> : null}
                      {imageCredit ? <span>{imageCredit}</span> : null}
                    </div>
                  ) : null}

                  {displaySummary ? (
                    <p className="mt-4 text-base md:text-lg text-slate-700">
                      {displaySummary}
                    </p>
                  ) : null}

                  {sponsoredMeta.isArticle ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-4 shadow-[0_16px_34px_-28px_rgba(180,83,9,0.35)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
                            Sponsor disclosure
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-700">
                            {sponsoredMeta.sponsorDisclosure}
                          </div>
                          {sponsoredMeta.sponsorName ? (
                            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Sponsor: {sponsoredMeta.sponsorName}
                            </div>
                          ) : null}
                        </div>

                        {sponsoredMeta.sponsorDestinationHref && sponsoredMeta.sponsorCtaLabel ? (
                          <a
                            href={sponsoredMeta.sponsorDestinationHref}
                            target={sponsoredMeta.sponsorDestinationIsExternal ? '_blank' : undefined}
                            rel={sponsoredMeta.sponsorDestinationIsExternal ? 'sponsored noopener noreferrer' : undefined}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
                          >
                            {sponsoredMeta.sponsorCtaLabel}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="px-4 md:px-6 pb-6">
                  <article lang={lang} className="article-body prose prose-slate max-w-none">
                    {paragraphBlocks.length ? (
                      paragraphBlocks.map((block, idx) => {
                        const controlledImage = parseControlledInlineImageBlock(block);
                        const controlledYouTube = controlledImage ? null : parseControlledYouTubeBlock(block);
                        const controlledX = controlledImage || controlledYouTube ? null : parseControlledXBlock(block);
                        const controlledInstagram = controlledImage || controlledYouTube || controlledX ? null : parseControlledInstagramBlock(block);
                        const controlledFacebook = controlledImage || controlledYouTube || controlledX || controlledInstagram ? null : parseControlledFacebookBlock(block);
                        const controlledGallery = controlledImage || controlledYouTube || controlledX || controlledInstagram || controlledFacebook ? null : parseControlledGalleryBlock(block);

                        return (
                          <React.Fragment key={`pblock-${idx}`}>
                            {controlledImage ? (
                              <ArticleInlineImage image={controlledImage} />
                            ) : controlledYouTube ? (
                              <ArticleYouTubeEmbed embed={controlledYouTube} />
                            ) : controlledX ? (
                              <ArticleXEmbed embed={controlledX} />
                            ) : controlledInstagram ? (
                              <ArticleInstagramEmbed embed={controlledInstagram} />
                            ) : controlledFacebook ? (
                              <ArticleFacebookEmbed embed={controlledFacebook} />
                            ) : controlledGallery ? (
                              <ArticleGallery gallery={controlledGallery} lang={lang} />
                            ) : (
                              <div dangerouslySetInnerHTML={{ __html: block }} />
                            )}
                          {inlineInsertAfterIndex === idx ? (
                            <ArticleDisplayAd slotId="ARTICLE_INLINE" />
                          ) : null}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: articleBodyHtml }} />
                    )}
                  </article>
                </div>

                {pulseDialogueMetadata ? (
                  <div className="px-4 md:px-6 pb-6">
                    <PulseDialogueArticleExtras metadata={pulseDialogueMetadata} t={t} />
                  </div>
                ) : null}

                <div className="px-4 md:px-6 pb-6">
                  <ArticleDisplayAd slotId="ARTICLE_END" />
                </div>
              </div>

              {/* Below-article: Related */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">{tx('common.relatedStories', 'Related Stories')}</div>
                </div>

                {relatedStories && relatedStories.length ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedStories.slice(0, 6).map((s, idx) => {
                      const id = getStoryId(s);
                      const localizedStory = getLocalizedArticleFields(s || {}, lang, STRICT_LOCALE_POLICY);
                      if (!localizedStory.isVisible) return null;
                      const href = id ? buildNewsUrl({ id, slug: localizedStory.slug || id, lang }) : '#';
                      const img = resolveCoverImageUrl(s, { lang }) || COVER_PLACEHOLDER_SRC;
                      const titleText = cleanText(localizedStory.title) || String(t('common.untitled') || 'Untitled').trim();
                      const excerpt = String(localizedStory.summary || '').trim();

                      debugStoryCard('article-related-grid', s, img);

                      return (
                        <RelatedStoryShell
                          key={getStoryReactKey(s, href)}
                          href={href}
                          className="group h-full rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 overflow-hidden"
                        >
                          <div className="flex h-full gap-3 p-3">
                            <StoryImage
                              storyId={id}
                              src={img}
                              alt={titleText}
                              variant="list"
                              className="border border-slate-200 bg-slate-100"
                            />
                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                              <div className="min-h-[2.8rem] line-clamp-2 text-sm font-bold leading-5 text-slate-900 group-hover:underline">{titleText}</div>
                              {excerpt ? <div className="mt-1 min-h-[2.5rem] line-clamp-2 text-xs leading-5 text-slate-600">{excerpt}</div> : <div className="mt-1 min-h-[2.5rem]" />}
                            </div>
                          </div>
                        </RelatedStoryShell>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{tx('common.noResults', 'No related stories yet.')}</div>
                )}
              </div>
            </section>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <ArticleReadingSidebar />
            </aside>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .article-body {
          color: #1e293b;
        }

        .article-body :where(p, li) {
          font-size: 1.04rem;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        .article-body :where(p) {
          margin: 0 0 1.05em;
        }

        .article-body :where(h2, h3) {
          color: #0f172a;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 1.8em;
          margin-bottom: 0.7em;
        }

        .article-body :where(h2) {
          font-size: 1.45rem;
        }

        .article-body :where(h3) {
          font-size: 1.22rem;
        }

        .article-body :where(p strong, p b, li strong, li b) {
          color: #0f172a;
          font-weight: 600;
        }

        .article-body :where(ul, ol) {
          margin: 1em 0 1.15em;
          padding-inline-start: 1.4rem;
        }

        .article-body :where(ul) {
          list-style-type: disc;
        }

        .article-body :where(ol) {
          list-style-type: decimal;
        }

        .article-body :where(li) {
          margin: 0.3em 0;
          padding-inline-start: 0.2rem;
        }

        .article-body :where(li::marker) {
          color: #475569;
          font-weight: 600;
        }

        .article-body :where(li > p) {
          margin: 0;
        }

        .article-body :where(li > p + p) {
          margin-top: 0.45em;
        }

        .article-body :where(ul ul, ul ol, ol ul, ol ol) {
          margin-top: 0.45em;
          margin-bottom: 0.45em;
        }

        .article-body :where(.np-inline-image) {
          clear: both;
          display: block;
          margin: 1.5rem 0;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-inline-image--normal) {
          max-width: 100%;
          width: 100%;
        }

        @media (min-width: 768px) {
          .article-body :where(.np-inline-image--wide) {
            margin-left: -0.75rem;
            margin-right: -0.75rem;
            max-width: calc(100% + 1.5rem);
            width: calc(100% + 1.5rem);
          }

          .article-body :where(.np-inline-image--full) {
            margin-left: -1.5rem;
            margin-right: -1.5rem;
            max-width: calc(100% + 3rem);
            width: calc(100% + 3rem);
          }
        }

        .article-body :where(.np-inline-image__frame) {
          align-items: center;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          max-width: 100%;
          overflow: hidden;
          width: 100%;
        }

        .article-body :where(.np-inline-image__media) {
          display: block;
          height: auto;
          max-width: 100%;
          object-fit: contain;
          width: 100%;
        }

        .article-body :where(.np-inline-image__fallback) {
          align-items: center;
          color: #64748b;
          display: flex;
          font-size: 0.92rem;
          justify-content: center;
          min-height: 12rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-inline-image__caption) {
          color: #475569;
          display: grid;
          gap: 0.12rem;
          line-height: 1.6;
          margin-top: 0.45rem;
          max-width: 100%;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .article-body :where(.np-inline-image__caption-text) {
          color: #475569;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0;
          line-height: 1.6;
        }

        .article-body :where(.np-inline-image__credit) {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 500;
          letter-spacing: 0;
          line-height: 1.45;
        }

        .article-body :where(.np-gallery) {
          clear: both;
          display: block;
          margin: 1.75rem 0;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-gallery__heading) {
          color: #0f172a;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.35;
          margin: 0 0 0.85rem;
        }

        .article-body :where(.np-gallery__item) {
          display: block;
          margin: 0;
          min-width: 0;
          width: 100%;
        }

        .article-body :where(.np-gallery__item--featured) {
          margin-bottom: 1rem;
        }

        .article-body :where(.np-gallery__grid) {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-gallery__frame) {
          align-items: center;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          max-width: 100%;
          overflow: hidden;
          width: 100%;
        }

        .article-body :where(.np-gallery__trigger) {
          appearance: none;
          color: inherit;
          cursor: zoom-in;
          font: inherit;
          padding: 0;
          text-align: inherit;
        }

        .article-body :where(.np-gallery__trigger:focus-visible) {
          outline: 3px solid rgba(37, 99, 235, 0.75);
          outline-offset: 3px;
        }

        .article-body :where(.np-gallery__media) {
          display: block;
          height: auto;
          max-height: 70vh;
          max-width: 100%;
          object-fit: contain;
          width: 100%;
        }

        .article-body :where(.np-gallery__fallback) {
          align-items: center;
          color: #64748b;
          display: flex;
          font-size: 0.92rem;
          justify-content: center;
          min-height: 12rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-gallery__caption) {
          color: #475569;
          display: grid;
          gap: 0.12rem;
          line-height: 1.6;
          margin-top: 0.45rem;
          max-width: 100%;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .article-body :where(.np-gallery__caption-text) {
          color: #475569;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0;
          line-height: 1.6;
        }

        .article-body :where(.np-gallery__credit) {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 500;
          letter-spacing: 0;
          line-height: 1.45;
        }

        .np-gallery-lightbox {
          align-items: center;
          background: rgba(2, 6, 23, 0.9);
          color: #f8fafc;
          display: flex;
          inset: 0;
          justify-content: center;
          min-height: 100dvh;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 0.75rem;
          position: fixed;
          z-index: 9999;
        }

        .np-gallery-lightbox__panel {
          display: grid;
          gap: 0.75rem;
          max-width: min(100%, 1080px);
          outline: none;
          width: 100%;
        }

        .np-gallery-lightbox__header {
          align-items: center;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: 1fr auto auto;
          min-width: 0;
        }

        .np-gallery-lightbox__title {
          color: #f8fafc;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1.4;
          min-width: 0;
        }

        .np-gallery-lightbox__count {
          color: #cbd5e1;
          font-size: 0.82rem;
          font-weight: 600;
          line-height: 1.4;
        }

        .np-gallery-lightbox__close,
        .np-gallery-lightbox__nav {
          align-items: center;
          appearance: none;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(226, 232, 240, 0.26);
          border-radius: 999px;
          color: #f8fafc;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          height: 2.75rem;
          justify-content: center;
          line-height: 1;
          min-width: 2.75rem;
          padding: 0;
        }

        .np-gallery-lightbox__close {
          font-size: 1.35rem;
        }

        .np-gallery-lightbox__nav {
          font-size: 1.8rem;
        }

        .np-gallery-lightbox__close:focus-visible,
        .np-gallery-lightbox__nav:focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.86);
          outline-offset: 3px;
        }

        .np-gallery-lightbox__nav:disabled {
          cursor: default;
          opacity: 0.35;
        }

        .np-gallery-lightbox__stage {
          align-items: center;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(2.75rem, auto) minmax(0, 1fr) minmax(2.75rem, auto);
          max-width: 100%;
          width: 100%;
        }

        .np-gallery-lightbox__figure {
          display: grid;
          gap: 0.55rem;
          margin: 0;
          min-width: 0;
          width: 100%;
        }

        .np-gallery-lightbox__media-frame {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: min(58vh, 34rem);
          min-width: 0;
          width: 100%;
        }

        .np-gallery-lightbox__media {
          display: block;
          height: auto;
          max-height: min(76vh, calc(100dvh - 10rem));
          max-width: 100%;
          object-fit: contain;
          width: auto;
        }

        .np-gallery-lightbox__fallback {
          align-items: center;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(226, 232, 240, 0.22);
          border-radius: 8px;
          color: #cbd5e1;
          display: flex;
          font-size: 0.95rem;
          justify-content: center;
          min-height: min(58vh, 34rem);
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .np-gallery-lightbox__caption {
          color: #e2e8f0;
          display: grid;
          gap: 0.12rem;
          line-height: 1.6;
          margin: 0 auto;
          max-width: min(100%, 920px);
          overflow-wrap: anywhere;
          text-align: left;
          width: 100%;
        }

        .np-gallery-lightbox__caption-text {
          color: #e2e8f0;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0;
          line-height: 1.6;
        }

        .np-gallery-lightbox__credit {
          color: #cbd5e1;
          font-size: 0.78rem;
          font-weight: 500;
          letter-spacing: 0;
          line-height: 1.45;
        }

        @media (max-width: 520px) {
          .np-gallery-lightbox {
            padding: 0.75rem 0.5rem;
          }

          .np-gallery-lightbox__stage {
            gap: 0.45rem;
          }

          .np-gallery-lightbox__media-frame,
          .np-gallery-lightbox__fallback {
            min-height: min(52vh, 30rem);
          }
        }

        @media (min-width: 768px) {
          .article-body :where(.np-gallery__grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .article-body :where(.np-youtube-embed) {
          clear: both;
          display: block;
          margin: 1.5rem 0;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-youtube-embed__frame) {
          background: #0f172a;
          border-radius: 8px;
          max-width: 100%;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-youtube-embed__iframe) {
          border: 0;
          display: block;
          height: 100%;
          inset: 0;
          position: absolute;
          width: 100%;
        }

        .article-body :where(.np-youtube-embed__fallback) {
          align-items: center;
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          font-size: 0.92rem;
          gap: 0.55rem;
          height: 100%;
          justify-content: center;
          min-height: 12rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-youtube-embed__fallback a) {
          color: #ffffff;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .article-body :where(.np-x-embed) {
          clear: both;
          display: block;
          margin: 1.5rem auto;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-x-embed__frame) {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          max-width: 100%;
          min-height: 18rem;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-x-embed__consent),
        .article-body :where(.np-x-embed__loader-shell) {
          min-height: 18rem;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-x-embed__container) {
          align-items: flex-start;
          display: flex;
          justify-content: center;
          min-height: 18rem;
          overflow-x: hidden;
          padding: 1rem;
          width: 100%;
        }

        .article-body :where(.np-x-embed__tweet) {
          margin: 0 auto !important;
          max-width: min(550px, 100%) !important;
          width: 100% !important;
        }

        .article-body :where(.np-x-embed__loading),
        .article-body :where(.np-x-embed__fallback) {
          align-items: center;
          color: #475569;
          display: flex;
          flex-direction: column;
          font-size: 0.92rem;
          gap: 0.55rem;
          justify-content: center;
          min-height: 18rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-x-embed__loading) {
          background: #f8fafc;
          inset: 0;
          position: absolute;
        }

        .article-body :where(.np-x-embed__fallback a) {
          color: #0f172a;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .article-body :where(.np-instagram-embed) {
          clear: both;
          display: block;
          margin: 1.5rem auto;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-instagram-embed__frame) {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          max-width: 100%;
          min-height: 34rem;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-instagram-embed__consent) {
          min-height: 34rem;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-instagram-embed__iframe) {
          border: 0;
          display: block;
          height: 34rem;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-instagram-embed__fallback) {
          align-items: center;
          color: #475569;
          display: flex;
          flex-direction: column;
          font-size: 0.92rem;
          gap: 0.55rem;
          justify-content: center;
          min-height: 34rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-instagram-embed__fallback a) {
          color: #0f172a;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 640px) {
          .article-body :where(.np-instagram-embed__frame),
          .article-body :where(.np-instagram-embed__consent),
          .article-body :where(.np-instagram-embed__fallback) {
            min-height: 30rem;
          }

          .article-body :where(.np-instagram-embed__iframe) {
            height: 30rem;
          }
        }

        .article-body :where(.np-facebook-embed) {
          clear: both;
          display: block;
          margin: 1.5rem auto;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-facebook-embed__frame) {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          max-width: 100%;
          min-height: 32rem;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-facebook-embed__consent) {
          min-height: 32rem;
          position: relative;
          width: 100%;
        }

        .article-body :where(.np-facebook-embed__iframe) {
          border: 0;
          display: block;
          height: 32rem;
          max-width: 100%;
          width: 100%;
        }

        .article-body :where(.np-facebook-embed__fallback) {
          align-items: center;
          color: #475569;
          display: flex;
          flex-direction: column;
          font-size: 0.92rem;
          gap: 0.55rem;
          justify-content: center;
          min-height: 32rem;
          padding: 2rem;
          text-align: center;
          width: 100%;
        }

        .article-body :where(.np-facebook-embed__fallback a) {
          color: #0f172a;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 640px) {
          .article-body :where(.np-facebook-embed__frame),
          .article-body :where(.np-facebook-embed__consent),
          .article-body :where(.np-facebook-embed__fallback) {
            min-height: 28rem;
          }

          .article-body :where(.np-facebook-embed__iframe) {
            height: 28rem;
          }
        }

        .article-body:lang(gu) :where(p, li),
        .article-body:lang(hi) :where(p, li) {
          line-height: 2;
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const locale = String(ctx.locale || lang);
  const siteUrl = resolvePublicSiteUrl(ctx.req);
  ctx.res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  ctx.res.setHeader('Pragma', 'no-cache');
  ctx.res.setHeader('Expires', '0');

  const messages = await (async () => {
    try {
      const { getMessages } = await import('../../lib/getMessages');
      return await getMessages(lang);
    } catch {
      return {};
    }
  })();

  const rawSlug = String((ctx.params as any)?.slug || '').trim();
  if (!rawSlug) {
    debugNewsDetailResolution('ssr-missing-slug', {
      locale: lang,
      receivedSlug: rawSlug,
      resolvedSlug: null,
      articleId: null,
      translationFound: false,
    });
    return {
      props: { messages, locale, lang, slug: '', article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found', pending: false, siteUrl },
    };
  }

  const getRequestOrigin = () => {
    const req = ctx.req;
    const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = protoHeader || 'http';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (!host) return '';
    return `${proto}://${host}`;
  };

  try {
    const origin = getRequestOrigin();
    const params = new URLSearchParams();
    params.set('lang', lang);
    params.set('language', lang);

    const headers = {
      Accept: 'application/json',
      cookie: String(ctx.req.headers.cookie || ''),
      authorization: String(ctx.req.headers.authorization || ''),
    };

    const endpoints = [
      `${origin}/api/public/news/slug/${encodeURIComponent(rawSlug)}?${params.toString()}`,
      `${origin}/api/public/news/${encodeURIComponent(rawSlug)}?${params.toString()}`,
    ];

    const { data, article } = await withPublicReadDeadline(4000, async (signal) => {
      let data: any = null;
      let article: Article | null = null;
      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store', signal });
        if (res.status === 404) { data = null; continue; }
        if (res.ok === false && res.status !== 404) throw new Error('Article upstream unavailable');
        const next = await res.json();
        signal.throwIfAborted();
        if (isPendingTranslationPayload(next)) {
          data = next;
          break;
        }
        const candidate = unwrapArticle(next);
        if (candidate?._id) {
          data = next;
          article = candidate;
          break;
        }
        data = next;
      }
      return { data, article };
    });

    if (isPendingTranslationPayload(data)) {
      debugNewsDetailResolution('ssr-pending', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: rawSlug,
        articleId: null,
        translationFound: false,
      });
      return {
        props: {
          messages,
          locale,
          lang,
          slug: rawSlug,
          article: null,
          safeHtml: '',
          topStories: [],
          relatedStories: [],
          error: null,
          pending: true,
          pendingSourceLang: getPendingSourceLang(data),
          siteUrl,
        },
      };
    }

    if (!article?._id) {
      debugNewsDetailResolution('ssr-not-found', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: null,
        articleId: null,
        translationFound: false,
      });
      return { notFound: true };
    }

    const primaryArticleId = String((article as any)?._id || '').trim();

    // Secondary lists are not needed to render the article, so they run alongside
    // the translation-group lookup instead of after it.
    const relatedPromise = withPublicReadDeadline(1500, async (signal) => {
      try {
        const categoryKey = resolveCategoryQueryKey(article);
        const limit = 24;
        const relatedParams = new URLSearchParams();
        if (categoryKey) relatedParams.set('category', categoryKey);
        relatedParams.set('lang', lang);
        relatedParams.set('language', lang);
        relatedParams.set('strictLocale', '1');
        relatedParams.set('limit', String(limit));

        const endpoint = `${origin}/api/public/news?${relatedParams.toString()}`;
        const res = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store', signal });
        if (res.ok === false) return [] as Article[];
        const listData = await res.json().catch(() => null);
        const itemsRaw =
          Array.isArray(listData) ? listData :
          Array.isArray(listData?.items) ? listData.items :
          Array.isArray(listData?.articles) ? listData.articles :
          Array.isArray(listData?.data) ? listData.data :
          [];

        return filterPubliclyPublishedArticles(Array.isArray(itemsRaw) ? (itemsRaw as Article[]) : []);
      } catch {
        return [] as Article[];
      }
    }).catch(() => [] as Article[]);

    // NOTE: /api/public/news/slug/[slug] and /api/public/news/[id] already resolve the
    // translation group with the same locale + policy, so repeating it here only added
    // a second blocking round trip for an identical result.

    const localized = getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY);
    if (!localized.isVisible) {
      debugNewsDetailResolution('ssr-hidden', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: localized.slug || rawSlug,
        articleId: String(article?._id || '').trim() || null,
        translationFound: localized.translationFound,
      });
      return { notFound: true };
    }

    const resolvedArticle = article;
    if (!resolvedArticle?._id) {
      return { notFound: true };
    }

    debugNewsDetailResolution('ssr-resolved', {
      locale: lang,
      receivedSlug: rawSlug,
      resolvedSlug: localized.slug || rawSlug,
      articleId: String(resolvedArticle._id || '').trim() || null,
      translationFound: localized.translationFound,
    });

    // Canonicalize slug per language
    const canonicalSlug = String(localized.slug || '').trim();
    if (canonicalSlug && canonicalSlug !== rawSlug) {
      const destination = buildNewsUrl({ id: String(resolvedArticle._id || '').trim(), slug: canonicalSlug, lang });
      return { redirect: { destination, permanent: true } };
    }

    const html = localized.bodyHtml;

    const extra = await (async () => {
      const items = await relatedPromise;
      const currentId = String((resolvedArticle as any)?._id || '').trim();

      const filtered = items.filter((x) => {
        const id = String((x as any)?._id || '').trim();
        if (!id) return false;
        return id !== currentId && id !== primaryArticleId;
      });

      const top = [...filtered];
      top.sort((a, b) => (Number((b as any)?.reads || 0) || 0) - (Number((a as any)?.reads || 0) || 0));

      return {
        topStories: top.slice(0, 10),
        relatedStories: filtered.slice(0, 12),
      };
    })();

    return {
      props: {
        messages,
        locale,
        lang,
        slug: rawSlug,
        article: resolvedArticle,
        safeHtml: sanitizeContent(html),
        topStories: extra.topStories,
        relatedStories: extra.relatedStories,
        error: null,
        pending: false,
        siteUrl,
        seo: {
          canonicalUrl: getArticleCanonicalUrl(resolvedArticle, lang, siteUrl),
          alternates: getArticleAlternates(resolvedArticle, siteUrl),
        },
      },
    };
  } catch {
    ctx.res.statusCode = 503;
    ctx.res.setHeader('Retry-After', '30');
    return {
      props: { messages, locale, lang, slug: rawSlug, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Article temporarily unavailable', pending: false, siteUrl },
    };
  }
};
