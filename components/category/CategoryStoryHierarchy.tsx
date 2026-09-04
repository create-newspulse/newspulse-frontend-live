import Link from 'next/link';
import React from 'react';

import { COVER_PLACEHOLDER_SRC } from '../../lib/coverImages';
import { isNavigableNewsHref } from '../../lib/newsRoutes';
import StoryImage from '../../src/components/story/StoryImage';

export type CategoryStoryHierarchyItem = {
  id: string;
  title: React.ReactNode;
  titleText: string;
  href?: string;
  summary?: React.ReactNode;
  summaryText?: string;
  imageSrc?: string;
  imageFitMode?: 'cover' | 'contain' | 'auto' | null;
  label?: string;
  meta?: Array<React.ReactNode>;
  dateIso?: string;
  dateLabel?: string;
  readingTime?: string;
  authorName?: string;
  authorDesignation?: string;
  raw?: unknown;
};

type Props = {
  items: CategoryStoryHierarchyItem[];
  categoryLabel: string;
  topLabel?: string;
  keyLabel?: string;
  latestLabel?: string;
  loadMoreLabel: string;
  emptyTitle: string;
  emptyHint?: string;
  loading?: boolean;
  variant?: 'news' | 'editorial' | 'web-stories';
  keyCount?: number;
  initialLatestCount?: number;
  loadMoreStep?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  autoLoadMore?: boolean;
  endOfFeedLabel?: string;
  onLoadMore?: () => void;
  renderTopActions?: (item: CategoryStoryHierarchyItem) => React.ReactNode;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function storyKey(item: CategoryStoryHierarchyItem): string {
  return String(item.id || item.href || item.titleText || '').trim().toLowerCase();
}

function dedupeStories(items: CategoryStoryHierarchyItem[]): CategoryStoryHierarchyItem[] {
  const seen = new Set<string>();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = storyKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canOpen(item: CategoryStoryHierarchyItem): boolean {
  return isNavigableNewsHref(String(item.href || '').trim());
}

function formatDateGroup(dateIso?: string): string {
  const text = String(dateIso || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (value === today) return 'Today';
  if (value === today - day) return 'Yesterday';

  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long' }).format(date);
  } catch {
    return text.slice(0, 10);
  }
}

function groupLatest(items: CategoryStoryHierarchyItem[]) {
  const groups: Array<{ label: string; items: CategoryStoryHierarchyItem[] }> = [];
  for (const item of items) {
    const label = formatDateGroup(item.dateIso) || 'Recent';
    const current = groups[groups.length - 1];
    if (current?.label === label) {
      current.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

function MetaRow({ item, compact = false }: { item: CategoryStoryHierarchyItem; compact?: boolean }) {
  const meta = [item.label, ...(item.meta || []), item.dateLabel, item.readingTime].filter(Boolean);
  if (!meta.length) return null;

  return (
    <div className={classNames('flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold uppercase tracking-[0.14em] text-slate-500', compact ? 'text-[10px]' : 'text-[11px]')}>
      {meta.map((value, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <span className="text-slate-300" aria-hidden="true">•</span> : null}
          <span>{value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function TitleLink({ item, className }: { item: CategoryStoryHierarchyItem; className: string }) {
  if (!canOpen(item)) return <div className={className}>{item.title}</div>;
  return (
    <Link href={item.href || '#'} className={classNames(className, 'hover:text-newsPulse-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40')}>
      {item.title}
    </Link>
  );
}

function TopStoryCard({ item, topLabel, renderTopActions }: { item: CategoryStoryHierarchyItem; topLabel: string; renderTopActions?: (item: CategoryStoryHierarchyItem) => React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_22px_48px_-38px_rgba(15,23,42,0.34)]">
      <div className="p-3 sm:p-4">
        {canOpen(item) ? (
          <Link href={item.href || '#'} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">
            <StoryImage storyId={item.id} src={item.imageSrc || COVER_PLACEHOLDER_SRC} alt={item.titleText} variant="top" fitMode={item.imageFitMode || 'cover'} priority fallbackSrc={COVER_PLACEHOLDER_SRC} />
          </Link>
        ) : (
          <StoryImage storyId={item.id} src={item.imageSrc || COVER_PLACEHOLDER_SRC} alt={item.titleText} variant="top" fitMode={item.imageFitMode || 'cover'} priority fallbackSrc={COVER_PLACEHOLDER_SRC} />
        )}

        <div className="mt-4">
          <div className="mb-2 inline-flex rounded-full border border-newsPulse-blue/20 bg-newsPulse-blue/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-newsPulse-blue">
            {topLabel}
          </div>
          <MetaRow item={item} />
          <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-newsPulse-navy sm:text-3xl">
            <TitleLink item={item} className="block" />
          </h2>
          {item.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-newsPulse-slate">{item.summary}</p> : null}
          {item.authorName ? (
            <div className="mt-3 text-sm text-newsPulse-navy">
              <div className="font-semibold">By {item.authorName}</div>
              {item.authorDesignation ? <div className="text-newsPulse-slate">{item.authorDesignation}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      {(renderTopActions || canOpen(item)) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 px-4 py-3">
          {renderTopActions ? renderTopActions(item) : null}
          {!renderTopActions && canOpen(item) ? (
            <Link href={item.href || '#'} className="inline-flex items-center justify-center rounded-2xl bg-newsPulse-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">
              Read More
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function KeyStoryCard({ item, editorial = false }: { item: CategoryStoryHierarchyItem; editorial?: boolean }) {
  const body = (
    <article className="h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
      {!editorial ? (
        <StoryImage storyId={item.id} src={item.imageSrc || COVER_PLACEHOLDER_SRC} alt={item.titleText} variant="card" fitMode={item.imageFitMode || 'cover'} fallbackSrc={COVER_PLACEHOLDER_SRC} className="rounded-b-none border-b border-slate-200/80" />
      ) : null}
      <div className="p-4">
        <MetaRow item={item} compact />
        <h3 className="mt-2 line-clamp-3 text-base font-black leading-snug text-newsPulse-navy group-hover:text-newsPulse-blue">
          {item.title}
        </h3>
        {editorial && item.summary ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-newsPulse-slate">{item.summary}</p> : null}
        {item.authorName ? <div className="mt-3 text-sm font-semibold text-newsPulse-navy">By {item.authorName}</div> : null}
      </div>
    </article>
  );

  if (!canOpen(item)) return <div>{body}</div>;
  return <Link href={item.href || '#'} className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">{body}</Link>;
}

function LatestRow({ item, editorial = false }: { item: CategoryStoryHierarchyItem; editorial?: boolean }) {
  const row = (
    <article className="grid grid-cols-[1fr_92px] gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition group-hover:border-slate-300 group-hover:bg-slate-50/70 sm:grid-cols-[1fr_116px]">
      <div className="min-w-0">
        <MetaRow item={item} compact />
        <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug text-newsPulse-navy group-hover:text-newsPulse-blue">
          {item.title}
        </h3>
        {item.summary ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-newsPulse-slate">{item.summary}</p> : null}
        {editorial && item.authorName ? <div className="mt-2 text-xs font-semibold text-newsPulse-slate">By {item.authorName}</div> : null}
      </div>
      {!editorial ? (
        <StoryImage storyId={item.id} src={item.imageSrc || COVER_PLACEHOLDER_SRC} alt={item.titleText} variant="mini" fitMode={item.imageFitMode || 'cover'} fallbackSrc={COVER_PLACEHOLDER_SRC} className="w-[92px] border border-slate-200/80 sm:w-[116px]" />
      ) : null}
    </article>
  );

  if (!canOpen(item)) return <div>{row}</div>;
  return <Link href={item.href || '#'} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">{row}</Link>;
}

function VisualStoryCover({ item }: { item: CategoryStoryHierarchyItem }) {
  const body = (
    <article className="h-full overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
      <div className="relative aspect-[9/16] overflow-hidden bg-slate-100">
        <img src={item.imageSrc || COVER_PLACEHOLDER_SRC} alt={item.titleText} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/84 via-slate-950/30 to-transparent p-3 text-white">
          <MetaRow item={item} compact />
          <h3 className="mt-2 line-clamp-3 text-sm font-black leading-snug">{item.title}</h3>
        </div>
      </div>
    </article>
  );

  if (!canOpen(item)) return <div>{body}</div>;
  return <Link href={item.href || '#'} className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40">{body}</Link>;
}

function WebStoriesHierarchy({ stories, loadMoreLabel, visibleCount, canLoadMore, loadingMore, onLoadMore, children }: {
  stories: CategoryStoryHierarchyItem[];
  loadMoreLabel: string;
  visibleCount: number;
  canLoadMore: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  children?: React.ReactNode;
}) {
  const [featured, ...covers] = stories;
  const visibleCovers = covers.slice(0, visibleCount);

  return (
    <div className="grid gap-4">
      {featured ? (
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
          <div className="grid gap-0 sm:grid-cols-[minmax(160px,240px)_1fr]">
            <VisualStoryCover item={featured} />
            <div className="p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-newsPulse-blue">Featured Web Story</div>
              <h2 className="mt-2 text-2xl font-black leading-tight text-newsPulse-navy"><TitleLink item={featured} className="block" /></h2>
              {featured.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-newsPulse-slate">{featured.summary}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {visibleCovers.length ? (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-newsPulse-blue/80">Web Stories</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibleCovers.map((item) => <VisualStoryCover key={storyKey(item)} item={item} />)}
          </div>
        </section>
      ) : null}

      {children || (canLoadMore ? <LoadMoreButton label={loadMoreLabel} loading={loadingMore} onClick={onLoadMore} /> : null)}
    </div>
  );
}

function LoadMoreButton({ label, loading, onClick }: { label: string; loading?: boolean; onClick?: () => void }) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full rounded-2xl border border-newsPulse-blue/25 bg-white px-4 py-3 text-sm font-black text-newsPulse-blue shadow-sm transition hover:border-newsPulse-blue/40 hover:bg-newsPulse-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[240px]"
      >
        {loading ? 'Loading...' : label}
      </button>
    </div>
  );
}

function LoadMoreBoundary({
  canLoadMore,
  loadingMore,
  loadMoreLabel,
  loadMoreError,
  endOfFeedLabel,
  autoLoadMore,
  onLoadMore,
}: {
  canLoadMore: boolean;
  loadingMore?: boolean;
  loadMoreLabel: string;
  loadMoreError?: string | null;
  endOfFeedLabel?: string;
  autoLoadMore?: boolean;
  onLoadMore?: () => void;
}) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!autoLoadMore || !canLoadMore || loadingMore || loadMoreError || !onLoadMore) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const node = sentinelRef.current;
    if (!node) return;

    let requested = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested || !entries.some((entry) => entry.isIntersecting)) return;
        requested = true;
        onLoadMore();
      },
      { root: null, rootMargin: '640px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoadMore, canLoadMore, loadingMore, loadMoreError, onLoadMore]);

  if (loadMoreError && canLoadMore) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="font-semibold">Unable to load more stories.</div>
        <div className="mt-1">{loadMoreError}</div>
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-3 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingMore ? 'Loading...' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <>
      {canLoadMore ? <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" /> : null}
      {canLoadMore ? <LoadMoreButton label={loadMoreLabel} loading={loadingMore} onClick={onLoadMore} /> : null}
      {!canLoadMore && endOfFeedLabel ? <div className="py-2 text-center text-sm font-semibold text-slate-500">{endOfFeedLabel}</div> : null}
    </>
  );
}

export default function CategoryStoryHierarchy({
  items,
  categoryLabel,
  topLabel,
  keyLabel = 'Key Stories',
  latestLabel = 'Latest',
  loadMoreLabel,
  emptyTitle,
  emptyHint,
  loading,
  variant = 'news',
  keyCount = 4,
  initialLatestCount,
  loadMoreStep = 12,
  hasMore = false,
  loadingMore = false,
  loadMoreError = null,
  autoLoadMore = false,
  endOfFeedLabel = "You're all caught up.",
  onLoadMore,
  renderTopActions,
}: Props) {
  const stories = React.useMemo(() => dedupeStories(items), [items]);
  const resetKey = stories.map(storyKey).join('|');
  const latestInitial = initialLatestCount ?? (variant === 'web-stories' ? 12 : variant === 'editorial' ? 8 : 8);
  const [visibleLatestCount, setVisibleLatestCount] = React.useState(latestInitial);

  React.useEffect(() => {
    setVisibleLatestCount(latestInitial);
  }, [latestInitial, resetKey]);

  const [, ...webStoryCovers] = stories;
  const [topStory, ...remainingStories] = stories;
  const keyStories = remainingStories.slice(0, keyCount);
  const latestStories = remainingStories.slice(keyCount);
  const visibleLatest = latestStories.slice(0, visibleLatestCount);
  const latestGroups = groupLatest(visibleLatest);
  const canLoadMore = variant === 'web-stories' ? visibleLatestCount < webStoryCovers.length || hasMore : visibleLatestCount < latestStories.length || hasMore;
  const handleLoadMore = React.useCallback(() => {
    const localRemaining = variant === 'web-stories' ? webStoryCovers.length : latestStories.length;
    if (visibleLatestCount < localRemaining) setVisibleLatestCount((count) => count + loadMoreStep);
    else onLoadMore?.();
  }, [latestStories.length, loadMoreStep, onLoadMore, variant, visibleLatestCount, webStoryCovers.length]);

  if (loading && !stories.length) return null;

  if (!stories.length) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold text-newsPulse-navy">{emptyTitle}</div>
        {emptyHint ? <div className="mt-2 text-sm leading-6 text-newsPulse-slate">{emptyHint}</div> : null}
      </div>
    );
  }

  if (variant === 'web-stories') {
    const coverCount = Math.max(0, visibleLatestCount);
    return (
      <WebStoriesHierarchy stories={stories} loadMoreLabel={loadMoreLabel} visibleCount={coverCount} canLoadMore={canLoadMore} loadingMore={loadingMore} onLoadMore={handleLoadMore}>
        <LoadMoreBoundary canLoadMore={canLoadMore} loadingMore={loadingMore} loadMoreLabel={loadMoreLabel} loadMoreError={loadMoreError} endOfFeedLabel={endOfFeedLabel} autoLoadMore={autoLoadMore} onLoadMore={handleLoadMore} />
      </WebStoriesHierarchy>
    );
  }

  const isEditorial = variant === 'editorial';

  return (
    <div className="grid gap-4">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-black tracking-tight text-newsPulse-navy">{categoryLabel}</div>
          <div className="text-sm text-newsPulse-slate">Top Story, Key Stories and Latest updates</div>
        </div>
      </div>

      {topStory ? <TopStoryCard item={topStory} topLabel={topLabel || (isEditorial ? 'Featured Editorial' : 'Top Story')} renderTopActions={renderTopActions} /> : null}

      {keyStories.length ? (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-newsPulse-blue/80">{keyLabel}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {keyStories.map((item) => <KeyStoryCard key={storyKey(item)} item={item} editorial={isEditorial} />)}
          </div>
        </section>
      ) : null}

      {visibleLatest.length ? (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-newsPulse-blue/80">{latestLabel}</div>
          <div className="mt-3 grid gap-4">
            {latestGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{group.label}</div>
                <div className="grid gap-2">
                  {group.items.map((item) => <LatestRow key={storyKey(item)} item={item} editorial={isEditorial} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <LoadMoreBoundary canLoadMore={canLoadMore} loadingMore={loadingMore} loadMoreLabel={loadMoreLabel} loadMoreError={loadMoreError} endOfFeedLabel={endOfFeedLabel} autoLoadMore={autoLoadMore} onLoadMore={handleLoadMore} />
    </div>
  );
}