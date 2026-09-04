import Link from 'next/link';
import React from 'react';

import OriginalTag from '../OriginalTag';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';
import { buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';
import { getStoryCategoryLabel, getStoryDateIso } from '../../lib/publicStories';
import { formatEditorialDateTime } from '../../lib/storyDateTime';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import StoryImage, { TopStoryImage } from '../../src/components/story/StoryImage';
import { normalizeRouteLocale } from '../../lib/localizedArticleFields';
import CategoryStoryHierarchy, { type CategoryStoryHierarchyItem } from '../category/CategoryStoryHierarchy';

type AnyStory = any;

type RegionalHomeStorySectionsProps = {
  stories: AnyStory[];
  requestedLang: 'en' | 'hi' | 'gu';
  loading?: boolean;
  stateName: string;
  categoryLabel: string;
  emptyTitle: string;
  emptyHint?: string;
  readMoreLabel: string;
  loadMoreLabel?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  onLoadMore?: () => void;
  fallbackCategoryLabel: string;
  showDistrictBadges?: boolean;
  getDistrictLabel?: (story: AnyStory) => string;
};

function normalizeKey(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getStoryId(story: AnyStory): string {
  return String(story?._id || story?.id || '').trim();
}

function estimateReadMinutes(text: string): number {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function isRenderableStory(story: AnyStory, requestedLang: 'en' | 'hi' | 'gu'): boolean {
  const id = getStoryId(story);
  if (!id) return false;

  const statusRaw = String(story?.status || story?.state || '').toLowerCase().trim();
  const deleted = story?.deleted === true || story?.isDeleted === true || Boolean(story?.deletedAt);
  const hasPublishedAt = Boolean(String(story?.publishedAt || '').trim());
  const isPublishedTrue = story?.isPublished === true || story?.published === true;
  const published =
    !deleted &&
    story?.isPublished !== false &&
    story?.published !== false &&
    (statusRaw ? statusRaw === 'published' : hasPublishedAt || isPublishedTrue);

  if (!published) return false;

  const rawLang = String(story?.language || story?.lang || story?.sourceLang || story?.sourceLanguage || '').trim();
  const storyLocale = rawLang ? normalizeRouteLocale(rawLang) : null;
  return !storyLocale || storyLocale === requestedLang;
}

function toStoryViewModel(story: AnyStory, requestedLang: 'en' | 'hi' | 'gu', fallbackCategoryLabel: string, getDistrictLabel?: (story: AnyStory) => string) {
  const id = getStoryId(story);
  const href = buildNewsUrl({ id, slug: id, lang: requestedLang });
  const title = typeof story?.title === 'string' ? story.title.trim() : '';
  const summary = typeof story?.summary === 'string' ? story.summary.trim() : '';
  const categoryLabel = getStoryCategoryLabel(story?.category) || story?.category || fallbackCategoryLabel;
  const districtLabel = typeof getDistrictLabel === 'function' ? String(getDistrictLabel(story) || '').trim() : '';
  const dateText = formatEditorialDateTime(getStoryDateIso(story));
  const imageSrc = resolveCoverImageUrl(story) || COVER_PLACEHOLDER_SRC;
  const readMinutes = estimateReadMinutes(`${title} ${summary} ${String(story?.content || '').trim()}`);
  const rawLang = String(story?.language || story?.lang || story?.sourceLang || story?.sourceLanguage || '').trim();
  const storyLocale = rawLang ? normalizeRouteLocale(rawLang) : null;

  return {
    id,
    href,
    title,
    summary,
    categoryLabel: String(categoryLabel || fallbackCategoryLabel).trim(),
    districtLabel,
    dateText,
    imageSrc,
    readMinutes,
    isOriginal: Boolean(storyLocale && storyLocale !== requestedLang),
  };
}

function EmptyRegionalStories({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      {hint ? <div className="mt-2 text-sm leading-6 text-slate-600">{hint}</div> : null}
    </div>
  );
}

function RegionalTopStory({ story, requestedLang, stateName, fallbackCategoryLabel, readMoreLabel, getDistrictLabel }: {
  story: AnyStory;
  requestedLang: 'en' | 'hi' | 'gu';
  stateName: string;
  fallbackCategoryLabel: string;
  readMoreLabel: string;
  getDistrictLabel?: (story: AnyStory) => string;
}) {
  const view = toStoryViewModel(story, requestedLang, fallbackCategoryLabel, getDistrictLabel);
  const titleParts = splitStoryTitleHook(view.title);
  const titleHookColor = getStoryTitleHookColor(view.categoryLabel || fallbackCategoryLabel);
  const canOpen = isNavigableNewsHref(view.href);
  const meta = [view.categoryLabel, view.districtLabel || stateName, view.dateText].filter(Boolean);

  const content = (
    <article className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.34)]">
      <div className="p-3 sm:p-4">
        <TopStoryImage storyId={view.id} src={view.imageSrc} alt={view.title} priority fallbackSrc={COVER_PLACEHOLDER_SRC} />

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="rounded-full border border-newsPulse-blue/20 bg-newsPulse-blue/10 px-2.5 py-1 font-black text-newsPulse-blue">
              Top Story
            </span>
            {meta.map((label) => (
              <span key={normalizeKey(label)}>{label}</span>
            ))}
            <span>{view.readMinutes} min read</span>
          </div>

          <h2 className="mt-3 line-clamp-3 text-2xl font-black leading-tight text-newsPulse-navy transition group-hover:text-newsPulse-blue sm:text-3xl">
            {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
            {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
            {!titleParts.highlightedHook && !titleParts.remainingTitle ? <span>{view.title}</span> : null}
          </h2>

          {view.isOriginal ? <div className="mt-2"><OriginalTag /></div> : null}
          {view.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-newsPulse-slate">{view.summary}</p> : null}
        </div>
      </div>

      {canOpen ? (
        <div className="border-t border-slate-200/80 px-4 py-3">
          <span className="inline-flex items-center justify-center rounded-2xl bg-newsPulse-blue px-4 py-2.5 text-sm font-semibold text-white">
            {readMoreLabel}
          </span>
        </div>
      ) : null}
    </article>
  );

  return canOpen ? (
    <Link href={view.href} className="group block top-story-card">
      {content}
    </Link>
  ) : (
    <div className="top-story-card">{content}</div>
  );
}

function RegionalFreshStories({ stories, requestedLang, fallbackCategoryLabel, readMoreLabel, getDistrictLabel }: {
  stories: AnyStory[];
  requestedLang: 'en' | 'hi' | 'gu';
  fallbackCategoryLabel: string;
  readMoreLabel: string;
  getDistrictLabel?: (story: AnyStory) => string;
}) {
  return (
    <section className="fresh-stories-card overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]">
      <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
        <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-newsPulse-slate">NEWS PULSE</div>
        <div className="mt-1 text-lg font-black tracking-tight text-newsPulse-navy">Fresh Stories</div>
      </div>

      <div className="grid gap-3 px-4 pb-5 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        {stories.map((story) => {
          const view = toStoryViewModel(story, requestedLang, fallbackCategoryLabel, getDistrictLabel);
          const titleParts = splitStoryTitleHook(view.title);
          const titleHookColor = getStoryTitleHookColor(view.categoryLabel || fallbackCategoryLabel);
          const canOpen = isNavigableNewsHref(view.href);
          const meta = [view.categoryLabel, view.districtLabel, view.dateText].filter(Boolean);
          const row = (
            <article className="grid grid-cols-[1fr_96px] items-start gap-4 rounded-[28px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.32)] transition group-hover:-translate-y-[1px] group-hover:shadow-[0_24px_46px_-30px_rgba(15,23,42,0.34)] sm:p-4 md:grid-cols-[1fr_148px]">
              <StoryImage
                storyId={view.id}
                src={view.imageSrc}
                fitMode="cover"
                alt={view.title}
                variant="mini"
                fallbackSrc={COVER_PLACEHOLDER_SRC}
                className="order-2 w-full border border-black/10 md:w-[148px]"
              />

              <div className="order-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {meta.map((label) => (
                    <span key={normalizeKey(label)} className={label === view.categoryLabel ? 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700' : undefined}>
                      {label}
                    </span>
                  ))}
                  <span>{view.readMinutes} min read</span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-lg font-black leading-snug tracking-tight text-newsPulse-navy transition group-hover:text-newsPulse-blue">
                  {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
                  {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
                  {!titleParts.highlightedHook && !titleParts.remainingTitle ? <span>{view.title}</span> : null}
                </h3>

                {view.isOriginal ? <div className="mt-2"><OriginalTag /></div> : null}
                {view.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-newsPulse-slate">{view.summary}</p> : null}

                {canOpen ? <div className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-newsPulse-blue">{readMoreLabel}</div> : null}
              </div>
            </article>
          );

          return canOpen ? (
            <Link key={view.id} href={view.href} className="group block">
              {row}
            </Link>
          ) : (
            <div key={view.id}>{row}</div>
          );
        })}
      </div>
    </section>
  );
}

export default function RegionalHomeStorySections({
  stories,
  requestedLang,
  loading,
  stateName,
  categoryLabel,
  emptyTitle,
  emptyHint,
  readMoreLabel,
  loadMoreLabel,
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
  fallbackCategoryLabel,
  showDistrictBadges,
  getDistrictLabel,
}: RegionalHomeStorySectionsProps) {
  const visibleStories = React.useMemo(() => {
    const seen = new Set<string>();
    return (Array.isArray(stories) ? stories : []).filter((story) => {
      if (!isRenderableStory(story, requestedLang)) return false;
      const id = getStoryId(story).toLowerCase();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [requestedLang, stories]);

  if (loading && !visibleStories.length) return null;

  if (!visibleStories.length) {
    return <EmptyRegionalStories title={emptyTitle} hint={emptyHint} />;
  }

  const hierarchyItems = visibleStories.map((story) => {
    const view = toStoryViewModel(story, requestedLang, fallbackCategoryLabel, showDistrictBadges ? getDistrictLabel : undefined);
    const titleParts = splitStoryTitleHook(view.title);
    const titleHookColor = getStoryTitleHookColor(view.categoryLabel || fallbackCategoryLabel);
    const title = (
      <>
        {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
        {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
        {!titleParts.highlightedHook && !titleParts.remainingTitle ? <span>{view.title}</span> : null}
      </>
    );

    return {
      id: view.id,
      href: isNavigableNewsHref(view.href) ? view.href : undefined,
      title,
      titleText: view.title,
      summary: view.summary,
      summaryText: view.summary,
      imageSrc: view.imageSrc,
      imageFitMode: 'cover',
      label: view.categoryLabel,
      meta: [view.districtLabel || stateName].filter(Boolean),
      dateIso: getStoryDateIso(story),
      dateLabel: view.dateText,
      readingTime: `${view.readMinutes} min read`,
      raw: story,
    } satisfies CategoryStoryHierarchyItem;
  });

  return (
    <CategoryStoryHierarchy
      items={hierarchyItems}
      categoryLabel={categoryLabel}
      topLabel="Gujarat Top Story"
      keyLabel="Gujarat Key Stories"
      latestLabel="Gujarat Latest"
      loadMoreLabel={loadMoreLabel || `Load More ${stateName} Stories`}
      emptyTitle={emptyTitle}
      emptyHint={emptyHint}
      loading={loading}
      hasMore={hasMore}
      loadingMore={loadingMore}
      loadMoreError={loadMoreError}
      autoLoadMore
      onLoadMore={onLoadMore}
      renderTopActions={(item) => (
        item.href ? (
          <Link href={item.href} className="inline-flex items-center justify-center rounded-2xl bg-newsPulse-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">
            {readMoreLabel}
          </Link>
        ) : null
      )}
    />
  );
}