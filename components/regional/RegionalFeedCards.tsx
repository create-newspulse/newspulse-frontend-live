import React from 'react';
import { getStoryCategoryLabel, getStoryDateIso } from '../../lib/publicStories';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

type AnyStory = any;

export type RegionalFeedCardsProps = {
  stories: AnyStory[];
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
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
}: {
  story: AnyStory;
  showDistrictBadges?: boolean;
  getDistrictLabel?: (story: AnyStory) => string;
}) {
  const href = story?._id ? `/story/${story._id}` : story?.slug ? `/story/${story.slug}` : '#';
  const categoryLabel = getStoryCategoryLabel(story?.category) || story?.category || 'Regional';
  const dateIso = getStoryDateIso(story);
  const dateText = dateIso ? new Date(dateIso).toLocaleString() : '';

  const districtLabel = showDistrictBadges && getDistrictLabel ? getDistrictLabel(story) : '';

  // Never render embeds/videos in cards; keep it clean.
  const title = story?.title || 'Untitled';
  const excerpt = story?.summary || story?.excerpt || (story?.content ? String(story.content).slice(0, 160) + '…' : '');

  return (
    <a
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {categoryLabel || 'Regional'}
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

      {!!excerpt && (
        <div className="mt-2 line-clamp-3 text-sm text-slate-600">
          {excerpt}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">{story?.location || ''}</span>
        <span className="text-sm font-medium text-blue-600 hover:underline">Read more →</span>
      </div>

      {/* Placeholder area for media (no embeds). */}
      {!!story?.videoUrl && (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
          Video preview hidden (embed disabled).
        </div>
      )}
    </a>
  );
}

export default function RegionalFeedCards({
  stories,
  loading,
  emptyTitle = 'No stories match your filters.',
  emptyHint = 'Try another category or clear search.',
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
              District-wise filtering activates when stories include district tags.
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
          showDistrictBadges={showDistrictBadges}
          getDistrictLabel={getDistrictLabel}
        />
      ))}
    </div>
  );
}
