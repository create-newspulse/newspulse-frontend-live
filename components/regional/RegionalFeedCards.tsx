import React from 'react';
import { getStoryCategoryLabel, getStoryDateIso } from '../../lib/publicStories';
import OriginalTag from '../OriginalTag';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';
import StoryImage from '../../src/components/story/StoryImage';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

type AnyStory = any;

function normalizeBadgeKey(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toSlug(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function tagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => String(t || '').trim())
      .filter(Boolean);
  }
  return [];
}

function extractFirstTaggedValue(tags: string[], key: 'state' | 'district' | 'city'): string {
  const prefixes = [`${key}:`, `${key}=`, `${key}-`];
  for (const raw of tags) {
    const t = normalizeBadgeKey(raw);
    for (const p of prefixes) {
      if (t.startsWith(p)) return String(raw).slice(p.length).trim();
    }
  }
  return '';
}

function prettifyLocationLabel(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // If it looks like a slug-ish ASCII token, make it human-friendly.
  const asciiSafe = /^[a-z0-9\s-]+$/i.test(raw);
  if (!asciiSafe) return raw;

  const spaced = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return raw;

  return spaced.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function stripKnownTagPrefixes(tag: string): string {
  const t = String(tag || '').trim();
  const lower = normalizeBadgeKey(t);
  const known = ['category:', 'category=', 'category-', 'tag:', 'tag=', 'tag-'];
  for (const p of known) {
    if (lower.startsWith(p)) return t.slice(p.length).trim();
  }
  return t;
}

function extractLocationRaw(story: AnyStory): { state: string; district: string; city: string } {
  const state =
    story?.state ||
    story?.stateName ||
    story?.location?.state ||
    story?.geo?.state ||
    story?.region?.state ||
    '';
  const district =
    story?.district ||
    story?.districtName ||
    story?.location?.district ||
    story?.geo?.district ||
    story?.region?.district ||
    '';
  const city =
    story?.city ||
    story?.cityName ||
    story?.location?.city ||
    story?.geo?.city ||
    story?.region?.city ||
    '';

  const tags = tagList(story?.tags);
  return {
    state: String(state || '').trim() || extractFirstTaggedValue(tags, 'state'),
    district: String(district || '').trim() || extractFirstTaggedValue(tags, 'district'),
    city: String(city || '').trim() || extractFirstTaggedValue(tags, 'city'),
  };
}

function dedupeLabels(labels: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const trimmed = String(label || '').trim();
    if (!trimmed) continue;
    const key = normalizeBadgeKey(trimmed);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export type RegionalFeedCardsProps = {
  stories: AnyStory[];
  requestedLang?: 'en' | 'hi' | 'gu';
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  districtFilterHint?: string;
  readMoreLabel?: string;
  videoPreviewHiddenLabel?: string;
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
  fallbackCategoryLabel,
  requestedLang,
}: {
  story: AnyStory;
  showDistrictBadges?: boolean;
  getDistrictLabel?: (story: AnyStory) => string;
  readMoreLabel: string;
  videoPreviewHiddenLabel: string;
  fallbackCategoryLabel: string;
  requestedLang: 'en' | 'hi' | 'gu';
}) {
  const id = String(story?._id || story?.id || '').trim();
  const slug = resolveArticleSlug(story, requestedLang);
  const href = id ? buildNewsUrl({ id, slug, lang: requestedLang }) : '#';
  const categoryLabel = getStoryCategoryLabel(story?.category) || story?.category || fallbackCategoryLabel;
  const dateIso = getStoryDateIso(story);
  const dateText = dateIso ? new Date(dateIso).toLocaleString() : '';

  const districtLabelFromProp = showDistrictBadges && getDistrictLabel ? getDistrictLabel(story) : '';

  const location = React.useMemo(() => extractLocationRaw(story), [story]);
  const districtSlug = toSlug(location.district);
  const citySlug = toSlug(location.city);

  const locationLabels = React.useMemo(() => {
    if (!showDistrictBadges) return [] as string[];

    const districtLabel = String(districtLabelFromProp || '').trim() || prettifyLocationLabel(location.district);
    const cityLabel = prettifyLocationLabel(location.city);
    const stateLabel = prettifyLocationLabel(location.state);

    const out: string[] = [];

    if (districtLabel) out.push(districtLabel);

    // If district/city resolve to the same place, only show one (prefer district).
    const cityDistinct = !!cityLabel && (!citySlug || !districtSlug || citySlug !== districtSlug);
    if (cityDistinct) out.push(cityLabel);

    // Fallback: if we have no district/city but do have a state, show state.
    if (!out.length && stateLabel) out.push(stateLabel);

    return out;
  }, [citySlug, districtLabelFromProp, districtSlug, location.district, location.state, location.city, showDistrictBadges]);

  const badgeLabels = React.useMemo(() => {
    const category = String(categoryLabel || fallbackCategoryLabel || '').trim();
    const categoryKey = normalizeBadgeKey(category);

    const tags = tagList(story?.tags);
    const tagBadges = tags
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      // Remove location tags (handled via normalized location).
      .filter((t) => {
        const key = normalizeBadgeKey(t);
        return !(key.startsWith('state:') || key.startsWith('state=') || key.startsWith('state-') || key.startsWith('district:') || key.startsWith('district=') || key.startsWith('district-') || key.startsWith('city:') || key.startsWith('city=') || key.startsWith('city-'));
      })
      // Normalize display label and filter anything duplicating the category.
      .map((t) => stripKnownTagPrefixes(t))
      .map((t) => prettifyLocationLabel(t))
      .filter((t) => {
        const key = normalizeBadgeKey(t);
        if (!key) return false;
        if (!categoryKey) return true;
        return key !== categoryKey;
      });

    // Keep category badge first, then location, then remaining tag badges.
    return dedupeLabels([category, ...locationLabels, ...tagBadges]);
  }, [categoryLabel, fallbackCategoryLabel, locationLabels, story?.tags]);

  // Render only the API-returned fields (no English fallbacks).
  const title = typeof story?.title === 'string' ? story.title.trim() : '';
  const summary = typeof story?.summary === 'string' ? story.summary.trim() : '';

  const storyLang = String(story?.language || story?.lang || '').toLowerCase().trim();
  const isOriginal = !!storyLang && storyLang !== requestedLang;

  const coverUrl = resolveCoverImageUrl(story);

  return (
    <a
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50"
    >
      <div className="mb-3 flex items-start gap-3">
        <StoryImage
          src={coverUrl || COVER_PLACEHOLDER_SRC}
          alt={title || ''}
          variant="mini"
          className="border border-slate-200"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {badgeLabels.map((label) => (
                <span
                  key={normalizeBadgeKey(label)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="shrink-0 text-xs text-slate-400">{dateText}</span>
          </div>

          {!!title ? <div className="mt-2 text-base font-semibold leading-snug">{title}</div> : null}

          {isOriginal ? (
            <div className="mt-1">
              <OriginalTag />
            </div>
          ) : null}

          {!!summary ? <div className="mt-2 text-sm text-slate-600 line-clamp-3">{summary}</div> : null}
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
  fallbackCategoryLabel = 'Regional',
  districtFilteringEnabled,
  showDistrictBadges,
  getDistrictLabel,
  className,
}: RegionalFeedCardsProps) {
  const dedupedStories = React.useMemo(() => {
    const input = Array.isArray(stories) ? stories : [];
    if (!input.length) return input;

    const seen = new Set<string>();
    const out: AnyStory[] = [];

    for (const s of input) {
      // Dedupe by "slug" as broadly as possible (handles slug/seoSlug/translations/slug_{lang}, etc).
      // If none exist, resolveArticleSlug falls back to _id/id.
      const key = String(resolveArticleSlug(s, requestedLang) || '').trim().toLowerCase();
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(s);
    }

    return out;
  }, [requestedLang, stories]);

  // Never render loading skeletons/placeholders.
  if (loading && !dedupedStories?.length) return null;

  if (!dedupedStories?.length) {
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
      {dedupedStories.map((story) => (
        <StoryCard
          key={story?._id || story?.slug || story?.title}
          story={story}
          requestedLang={requestedLang}
          showDistrictBadges={showDistrictBadges}
          getDistrictLabel={getDistrictLabel}
          readMoreLabel={readMoreLabel}
          videoPreviewHiddenLabel={videoPreviewHiddenLabel}
          fallbackCategoryLabel={fallbackCategoryLabel}
        />
      ))}
    </div>
  );
}
