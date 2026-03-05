import React from 'react';
import { getStoryCategoryLabel, getStoryDateIso } from '../../lib/publicStories';
import OriginalTag from '../OriginalTag';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { COVER_PLACEHOLDER_SRC, onCoverImageError, resolveCoverImageUrl } from '../../lib/coverImages';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

type AnyStory = any;

export type RegionalFeedCardsProps = {
  stories: AnyStory[];
  requestedLang?: 'en' | 'hi' | 'gu';
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
  requestedLang: 'en' | 'hi' | 'gu';
}) {
  const id = String(story?._id || story?.id || '').trim();
  const slug = resolveArticleSlug(story, requestedLang);
  const href = id ? buildNewsUrl({ id, slug, lang: requestedLang }) : '#';
  const categoryLabel = getStoryCategoryLabel(story?.category) || story?.category || fallbackCategoryLabel;
  const dateIso = getStoryDateIso(story);
  const dateText = dateIso ? new Date(dateIso).toLocaleString() : '';

  const districtLabel = showDistrictBadges && getDistrictLabel ? getDistrictLabel(story) : '';

  const title = String(story?.title || '').trim() || untitledLabel;
  const summary = typeof story?.summary === 'string' ? story.summary.trim() : '';

  const storyLang = String(story?.language || story?.lang || '').toLowerCase().trim();
  const isOriginal = !!storyLang && storyLang !== requestedLang;

  const coverUrl = resolveCoverImageUrl(story);

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
                <div className="mb-3 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl || COVER_PLACEHOLDER_SRC}
                    alt=""
                    loading="lazy"
                    onError={onCoverImageError}
                    className="h-16 w-24 rounded-xl border border-slate-200 bg-slate-100 object-cover"
                  />

                  <div className="min-w-0 flex-1">
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

                    <div className="mt-2 text-base font-semibold leading-snug">{title}</div>

                    {isOriginal ? (
                      <div className="mt-1">
                        <OriginalTag />
                      </div>
                    ) : null}

                    {!!summary ? (
                      <div className="mt-2 text-sm text-slate-600 line-clamp-3">{summary}</div>
                    ) : null}
                  </div>
                </div>
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
  // Never render loading skeletons/placeholders.
  if (loading && !stories?.length) return null;

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
