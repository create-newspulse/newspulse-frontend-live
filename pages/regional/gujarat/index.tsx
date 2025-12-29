import Head from 'next/head';
import React, { useEffect, useMemo, useState } from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

import LanguageToggle from '../../../components/LanguageToggle';
import BreakingTicker from '../../../components/regional/BreakingTicker';
import DistrictChipBar from '../../../components/regional/DistrictChipBar';
import DistrictPicker from '../../../components/regional/DistrictPicker';
import CategoryRail from '../../../components/regional/CategoryRail';
import RegionalTabs, { type RegionalTabKey } from '../../../components/regional/RegionalTabs';
import RegionalFeedCards from '../../../components/regional/RegionalFeedCards';

import { fetchPublicStories, getStoryCategoryLabel } from '../../../lib/publicStories';
import { GUJARAT_DISTRICTS } from '../../../utils/regions';
import { useLanguage } from '../../../utils/LanguageContext';
import { getStateName, tHeading } from '../../../utils/localizedNames';

const CATEGORIES = [
  'All',
  'Civic',
  'Politics',
  'Crime',
  'Jobs',
  'Weather',
  'Business',
  'Education',
  'Culture',
  'Development',
] as const;

type AnyStory = any;

function normalize(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDistrict(story: AnyStory): string {
  return (
    story?.district ||
    story?.districtName ||
    story?.location?.district ||
    story?.geo?.district ||
    story?.region?.district ||
    ''
  );
}

function extractCategory(story: AnyStory): string {
  return (
    getStoryCategoryLabel(story?.category) ||
    story?.categoryName ||
    story?.section ||
    story?.topic ||
    ''
  );
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

function isPublished(story: AnyStory): boolean {
  return String(story?.status || '').toLowerCase() === 'published';
}

function isBreakingStory(story: AnyStory): boolean {
  const categoryLabel = String(getStoryCategoryLabel(story?.category) || story?.category || '').toLowerCase().trim();
  const tags = tagList(story?.tags);
  return categoryLabel === 'breaking' || tags.includes('breaking') || tags.includes('tag:breaking');
}

function isGujaratTagged(story: AnyStory): boolean {
  const tags = tagList(story?.tags);
  if (tags.includes('state:gujarat') || tags.includes('gujarat') || tags.includes('state-gujarat')) return true;

  // Treat district/city tagged items as Gujarat-relevant for this page.
  if (tags.some((t) => t.startsWith('district:') || t.startsWith('city:'))) return true;

  // Also match against known Gujarat districts by slug/name.
  const districtTokens = new Set(
    GUJARAT_DISTRICTS.flatMap((d) => [String(d.slug || '').toLowerCase(), String(d.name || '').toLowerCase()]).filter(Boolean)
  );
  if (tags.some((t) => districtTokens.has(t))) return true;

  const districtField = String(extractDistrict(story) || '').toLowerCase().trim();
  if (districtField && districtTokens.has(districtField)) return true;

  return false;
}

export default function GujaratIndexPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [tab, setTab] = useState<RegionalTabKey>('Feed');
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [stories, setStories] = useState<AnyStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicStories()
      .then((items) => {
        if (cancelled) return;
        setStories(items as AnyStory[]);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load stories');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const districtFilteringEnabled = useMemo(() => stories.some((s) => !!extractDistrict(s)), [stories]);

  const effectiveCategory = useMemo(() => (tab === 'Civic' ? 'Civic' : selectedCategory), [tab, selectedCategory]);

  const filteredStories = useMemo(() => {
    let list = stories;

    // Category filter
    if (effectiveCategory !== 'All') {
      const wanted = normalize(effectiveCategory);
      list = list.filter((s) => normalize(extractCategory(s)).includes(wanted));
    }

    // Search filter
    const q = normalize(searchQuery);
    if (q) {
      list = list.filter((s) => {
        const hay = normalize(`${s?.title || ''} ${s?.summary || ''} ${s?.excerpt || ''} ${s?.content || ''}`);
        return hay.includes(q);
      });
    }

    return list;
  }, [stories, effectiveCategory, searchQuery]);

  const tickerItems = useMemo(() => {
    const breakingItems = (stories || []).filter((s) => isPublished(s) && isBreakingStory(s));
    const gujaratBreakingItems = breakingItems.filter((s) => isGujaratTagged(s));
    const chosen = gujaratBreakingItems.length ? gujaratBreakingItems : breakingItems;
    return chosen.slice(0, 12);
  }, [stories]);

  const stateName = getStateName(language as any, 'gujarat', 'Gujarat');

  const onSelectCategory = (c: (typeof CATEGORIES)[number]) => {
    setSelectedCategory(c);
    if (c === 'Civic') setTab('Civic');
    else setTab('Feed');
  };

  const onSelectDistrict = (slug: string) => {
    setPickerOpen(false);
    setTab('Feed');
    router.push(`/regional/gujarat/${slug}`);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <title>{`Regional Pulse – Gujarat | News Pulse`}</title>
        <meta name="description" content={`Regional Pulse feed for Gujarat.`} />
      </Head>

      <div className="sticky top-0 z-40">
        {tab === 'Feed' && (
          <BreakingTicker
            items={tickerItems}
            variant="breaking"
            emptyText="No breaking news right now — stay tuned"
          />
        )}

        <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-3xl font-black tracking-tight">Regional Pulse – {stateName}</div>
                <div className="text-sm text-slate-600">{tHeading(language as any, 'regional')} feed • Gujarat</div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[340px]">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search headline…"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</div>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                  title="Pick a district"
                >
                  All Gujarat
                </button>

                <div className="sm:pl-1">
                  <LanguageToggle />
                </div>
              </div>
            </div>

            <DistrictChipBar
              className="mt-3"
              districts={GUJARAT_DISTRICTS}
              selectedDistrictSlug={null}
              onSelectAll={() => router.push('/regional/gujarat')}
              onSelectDistrict={onSelectDistrict}
              onMore={() => setPickerOpen(true)}
            />

            <div className="mt-2">
              <CategoryRail categories={[...CATEGORIES]} selected={effectiveCategory} onSelect={onSelectCategory} />
            </div>

            <RegionalTabs
              className="mt-3"
              value={tab}
              onChange={(t) => {
                setTab(t);
                if (t === 'Civic') setSelectedCategory('Civic');
              }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {!!error && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {error}
          </div>
        )}

        {districtFilteringEnabled === false && (
          <div className="mb-4 text-sm text-slate-500">
            District-wise filtering activates when stories include district tags.
          </div>
        )}

        {tab === 'Districts' ? (
          <div>
            <div className="mb-4">
              <div className="text-2xl font-bold">Gujarat districts</div>
              <div className="text-sm text-slate-600">Tap a district to open its feed.</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GUJARAT_DISTRICTS.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => onSelectDistrict(d.slug)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50"
                >
                  <div className="text-base font-semibold">{d.name}</div>
                  <div className="text-sm text-slate-500">District · Gujarat</div>
                </button>
              ))}
            </div>
          </div>
        ) : tab === 'Map' ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4">
              <div className="text-base font-semibold">Explore on Map</div>
              <div className="mt-1 text-sm text-slate-600">Map embed is intentionally disabled in this UI canvas.</div>
              <div className="mt-4 h-[420px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Placeholder: interactive Gujarat map will land here.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-2xl font-bold">Latest from Gujarat</div>
                <div className="text-sm text-slate-600">
                  {effectiveCategory === 'All' ? 'All local categories' : `Category: ${effectiveCategory}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  setTab('Feed');
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            <RegionalFeedCards
              stories={filteredStories}
              loading={loading}
              districtFilteringEnabled={districtFilteringEnabled}
              showDistrictBadges={districtFilteringEnabled}
              getDistrictLabel={extractDistrict}
            />
          </>
        )}
      </div>

      <DistrictPicker
        open={pickerOpen}
        districts={GUJARAT_DISTRICTS}
        onClose={() => setPickerOpen(false)}
        onPickAll={() => router.push('/regional/gujarat')}
        onPickDistrict={onSelectDistrict}
      />

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-600">Regional Pulse – Gujarat</div>
      </footer>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../../../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
