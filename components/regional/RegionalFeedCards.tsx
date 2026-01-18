import React from 'react';
import { getStoryCategoryLabel, getStoryDateIso } from '../../lib/publicStories';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../lib/contentFallback';
import OriginalTag from '../OriginalTag';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

type AnyStory = any;

export type RegionalFeedCardsProps = {
  stories: AnyStory[];
  requestedLang?: UiLang;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  districtFilterHint?: string;
  readMoreLabel?: string;
  videoPreviewHiddenLabel?: string;
  untitledLabel?: string;
  fallbackCategoryLabel?: string;
  districtFilteringEnabled?: boolean;
  showDistrictBadges?: boolean;
  getDistrictLabel?: (story: AnyStory) => string;
  className?: string;
};

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

function StoryCard({
  story,
  showDistrictBadges,
  getDistrictLabel,
  readMoreLabel,
  videoPreviewHiddenLabel,
  untitledLabel,
  fallbackCategoryLabel,
  requestedLang,
}: {
  story: AnyStory;
  showDistrictBadges?: boolean;
  getDistrictLabel?: (story: AnyStory) => string;
  readMoreLabel: string;
  videoPreviewHiddenLabel: string;
  untitledLabel: string;
  fallbackCategoryLabel: string;
  requestedLang: UiLang;
}) {
  const href = story?._id ? `/story/${story._id}` : story?.slug ? `/story/${story.slug}` : '#';
  const categoryLabel = getStoryCategoryLabel(story?.category) || story?.category || fallbackCategoryLabel;
  const dateIso = getStoryDateIso(story);
  const dateText = dateIso ? new Date(dateIso).toLocaleString() : '';

  const districtLabel = showDistrictBadges && getDistrictLabel ? getDistrictLabel(story) : '';

  // Never render embeds/videos in cards; keep it clean.
  const titleRes = resolveArticleTitle(story, requestedLang);
  const summaryRes = resolveArticleSummaryOrExcerpt(story, requestedLang);

  const title = titleRes.text || story?.title || untitledLabel;
  const excerpt =
    summaryRes.text ||
    story?.summary ||
    story?.excerpt ||
    (story?.content ? String(story.content).slice(0, 160) + '…' : '');

  return (
    <a
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {categoryLabel || fallbackCategoryLabel}
          </span>
          {!!districtLabel && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {districtLabel}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-slate-400">{dateText}</span>
      </div>

      <div className="mt-3 text-base font-semibold leading-snug">{title}</div>

      {titleRes.isOriginal ? (
        <div className="mt-1">
          <OriginalTag />
        </div>
      ) : null}

      {!!excerpt && (
        <div className="mt-2 line-clamp-3 text-sm text-slate-600">
          {excerpt}
          {summaryRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">{story?.location || ''}</span>
        <span className="text-sm font-medium text-blue-600 hover:underline">{readMoreLabel}</span>
      </div>

      {/* Placeholder area for media (no embeds). */}
      {!!story?.videoUrl && (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
          {videoPreviewHiddenLabel}
        </div>
      )}
    </a>
  );
}

export default function RegionalFeedCards({
  stories,
  requestedLang = 'en',
  loading,
  emptyTitle = 'No stories match your filters.',
  emptyHint = 'Try another category or clear search.',
  districtFilterHint = 'District-wise filtering activates when stories include district tags.',
  readMoreLabel = 'Read more →',
  videoPreviewHiddenLabel = 'Video preview hidden (embed disabled).',
  untitledLabel = 'Untitled',
  fallbackCategoryLabel = 'Regional',
  districtFilteringEnabled,
  showDistrictBadges,
  getDistrictLabel,
  className,
}: RegionalFeedCardsProps) {
  if (loading) {
    return (
      <div className={classNames('grid gap-4 md:grid-cols-2', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  if (!stories?.length) {
    return (
      <CardShell>
        <div className="p-6">
          <div className="text-base font-semibold">{emptyTitle}</div>
          <div className="mt-2 text-sm text-slate-600">{emptyHint}</div>
          {districtFilteringEnabled === false && (
            <div className="mt-3 text-sm text-slate-500">
              {districtFilterHint}
            </div>
          )}
        </div>
      </CardShell>
    );
  }

  return (
    <div className={classNames('grid gap-4 md:grid-cols-2', className)}>
      {stories.map((story) => (
        <StoryCard
          key={story?._id || story?.slug || story?.title}
          story={story}
          requestedLang={requestedLang}
          showDistrictBadges={showDistrictBadges}
          getDistrictLabel={getDistrictLabel}
          readMoreLabel={readMoreLabel}
          videoPreviewHiddenLabel={videoPreviewHiddenLabel}
          untitledLabel={untitledLabel}
          fallbackCategoryLabel={fallbackCategoryLabel}
        />
      ))}
    </div>
  );
}
