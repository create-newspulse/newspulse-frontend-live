import Head from 'next/head';
import React from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

import BreakingTicker from '../../../components/regional/BreakingTicker';
import DistrictChipBar from '../../../components/regional/DistrictChipBar';
import DistrictPicker from '../../../components/regional/DistrictPicker';
import CategoryRail from '../../../components/regional/CategoryRail';
import RegionalTabs, { type RegionalTabKey } from '../../../components/regional/RegionalTabs';
import RegionalFeedCards from '../../../components/regional/RegionalFeedCards';

import { fetchPublicStories, getStoryCategoryLabel } from '../../../lib/publicStories';
import { GUJARAT_DISTRICTS } from '../../../utils/regions';
import { useLanguage } from '../../../utils/LanguageContext';
import { getGujaratDistrictName, getStateName, tHeading, toLanguageKey } from '../../../utils/localizedNames';
import { normalizeLang, useI18n } from '../../../src/i18n/LanguageProvider';

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
  const raw = String(s || '')
    .normalize('NFKC')
    .toLowerCase();

  try {
    const unicodeRe = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');

    return raw
      .replace(unicodeRe, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return raw
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function toSlug(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
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

function extractDistrictSlugFromStory(story: AnyStory): string {
  const direct =
    story?.districtSlug ||
    story?.district_slug ||
    story?.districtCode ||
    story?.district_code ||
    story?.districtId ||
    story?.district_id ||
    '';

  const directValue = String(direct || '').toLowerCase().trim();
  if (directValue) return toSlug(directValue);

  const tags = tagList(story?.tags);
  for (const t of tags) {
    if (t.startsWith('district:')) return toSlug(t.slice('district:'.length));
    if (t.startsWith('district-')) return toSlug(t.slice('district-'.length));
    if (t.startsWith('district=')) return toSlug(t.slice('district='.length));
  }

  return '';
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
  const { t } = useI18n();

  const queryLang = React.useMemo(() => {
    const raw = (router.query as any)?.lang;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value || '').trim();
  }, [router.query]);

  const effectiveLang = React.useMemo(() => {
    // Priority: query (from rewrites) -> route locale -> persisted/provider language -> default
    return normalizeLang(queryLang || router.locale || language || 'en');
  }, [language, queryLang, router.locale]);

  const pushPath = React.useCallback(
    (path: string) => {
      const next = String(path || '/');
      // Use effective language instead of router.locale.
      // Some production rewrites use `locale: false`, which can leave router.locale as "en"
      // even when the URL is clearly /hi or /gu.
      router.push(next, next, { locale: effectiveLang }).catch(() => {});
    },
    [effectiveLang, router]
  );

  const uiLang = React.useMemo(() => effectiveLang, [effectiveLang]);

  const langKey = React.useMemo(() => toLanguageKey(effectiveLang), [effectiveLang]);

  const localizedDistricts = React.useMemo(
    () => GUJARAT_DISTRICTS.map((d) => ({ ...d, name: getGujaratDistrictName(langKey, d.slug, d.name) })),
    [langKey]
  );

  const getLocalizedDistrictFromStory = React.useCallback(
    (story: AnyStory) => {
      const raw = String(extractDistrict(story) || '').trim();
      if (!raw) return '';
      const slug = toSlug(raw);
      return slug ? getGujaratDistrictName(langKey, slug, raw) : raw;
    },
    [langKey]
  );

  const [tab, setTab] = React.useState<RegionalTabKey>('Feed');
  const [selectedCategory, setSelectedCategory] = React.useState<(typeof CATEGORIES)[number]>('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const [stories, setStories] = React.useState<AnyStory[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicStories(undefined, { language: uiLang, category: 'regional', state: 'gujarat' })
      .then((items) => {
        if (cancelled) return;
        setStories(items as AnyStory[]);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || t('regionalUI.failedToLoadStories'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t, uiLang]);

  const districtFilteringEnabled = React.useMemo(
    () =>
      stories.some((s) => {
        if (extractDistrictSlugFromStory(s)) return true;
        if (String(extractDistrict(s) || '').trim()) return true;
        const tags = tagList(s?.tags);
        return tags.some((t) => t.startsWith('district:') || t.startsWith('city:'));
      }),
    [stories]
  );

  const effectiveCategory = React.useMemo(() => (tab === 'Civic' ? 'Civic' : selectedCategory), [tab, selectedCategory]);

  const tTopicChip = (c: string) => {
    switch (c) {
      case 'All':
        return t('topics.all');
      case 'Civic':
        return t('topics.civic');
      case 'Politics':
        return t('topics.politics');
      case 'Crime':
        return t('topics.crime');
      case 'Jobs':
        return t('topics.jobs');
      case 'Weather':
        return t('topics.weather');
      case 'Business':
        return t('topics.business');
      case 'Education':
        return t('topics.education');
      case 'Culture':
        return t('topics.culture');
      case 'Development':
        return t('topics.development');
      default:
        return c;
    }
  };

  const filteredStories = React.useMemo(() => {
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

  const tickerItems = React.useMemo(() => {
    const breakingItems = (stories || []).filter((s) => isPublished(s) && isBreakingStory(s));
    const gujaratBreakingItems = breakingItems.filter((s) => isGujaratTagged(s));
    const chosen = gujaratBreakingItems.length ? gujaratBreakingItems : breakingItems;
    return chosen.slice(0, 12);
  }, [stories]);

  const stateName = getStateName(langKey, 'gujarat', 'Gujarat');

  const onSelectCategory = (c: (typeof CATEGORIES)[number]) => {
    setSelectedCategory(c);
    if (c === 'Civic') setTab('Civic');
    else setTab('Feed');
  };

  const onSelectDistrict = (slug: string) => {
    setPickerOpen(false);
    setTab('Feed');
    pushPath(`/regional/gujarat/${slug}`);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <title>{t('regionalGujaratPage.headTitle')}</title>
        <meta name="description" content={t('regionalGujaratPage.headDescription')} />
      </Head>

      <div className="sticky top-0 z-40">
        {tab === 'Feed' && (
          <BreakingTicker
            items={tickerItems}
            variant="breaking"
            emptyText={t('home.noBreaking')}
          />
        )}

        <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-3xl font-black tracking-tight">
                  {t('regionalGujaratPage.regionalPulse')} – {stateName}
                </div>
                <div className="text-sm text-slate-600">
                  {tHeading(language as any, 'regional')} {t('regionalGujaratPage.feedWord')} • {stateName}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[340px]">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('regionalGujaratPage.searchPlaceholder')}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</div>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                  title={t('regionalGujaratPage.pickDistrictTitle')}
                >
                  {t('regionalUI.allGujarat')}
                </button>
              </div>
            </div>

            <DistrictChipBar
              className="mt-3"
              districts={localizedDistricts}
              selectedDistrictSlug={null}
              onSelectAll={() => pushPath('/regional/gujarat')}
              onSelectDistrict={onSelectDistrict}
              onMore={() => setPickerOpen(true)}
              allLabel={t('regionalUI.allGujarat')}
              moreLabel={t('regionalUI.more')}
            />

            <div className="mt-2">
              <CategoryRail
                categories={[...CATEGORIES]}
                selected={effectiveCategory}
                onSelect={onSelectCategory}
                getLabel={tTopicChip}
              />
            </div>

            <RegionalTabs
              className="mt-3"
              value={tab}
              onChange={(t0) => {
                setTab(t0);
                if (t0 === 'Civic') setSelectedCategory('Civic');
              }}
              getLabel={(k) => {
                switch (k) {
                  case 'Feed':
                    return t('regionalUI.tabFeed');
                  case 'Districts':
                    return t('regionalUI.tabDistricts');
                  case 'Civic':
                    return t('regionalUI.tabCivic');
                  case 'Map':
                    return t('regionalUI.tabMap');
                  default:
                    return k;
                }
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
            {t('regionalUI.districtFilterHint')}
          </div>
        )}

        {tab === 'Districts' ? (
          <div>
            <div className="mb-4">
              <div className="text-2xl font-bold">
                {stateName} {t('regionalGujaratPage.districtsTitleSuffix')}
              </div>
              <div className="text-sm text-slate-600">{t('regionalGujaratPage.tapDistrictHint')}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localizedDistricts.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => onSelectDistrict(d.slug)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50"
                >
                  <div className="text-base font-semibold">{d.name}</div>
                  <div className="text-sm text-slate-500">
                    {t('regionalGujaratPage.districtLabel')} · {stateName}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : tab === 'Map' ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4">
              <div className="text-base font-semibold">{t('regionalGujaratPage.exploreOnMap')}</div>
              <div className="mt-1 text-sm text-slate-600">{t('regionalGujaratPage.mapDisabledHint')}</div>
              <div className="mt-4 h-[420px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                {t('regionalGujaratPage.mapPlaceholder')}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {t('regionalGujaratPage.latestFrom')} {stateName}
                </div>
                <div className="text-sm text-slate-600">
                  {effectiveCategory === 'All'
                    ? t('regionalGujaratPage.allLocalCategories')
                    : `${t('regionalGujaratPage.categoryPrefix')} ${tTopicChip(effectiveCategory)}`}
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
                {t('common.reset')}
              </button>
            </div>

            <RegionalFeedCards
              stories={filteredStories}
              requestedLang={uiLang}
              loading={loading}
              districtFilteringEnabled={districtFilteringEnabled}
              showDistrictBadges={districtFilteringEnabled}
              getDistrictLabel={getLocalizedDistrictFromStory}
              emptyTitle={t('regionalUI.emptyTitle')}
              emptyHint={t('regionalUI.emptyHint')}
              districtFilterHint={t('regionalUI.districtFilterHint')}
              readMoreLabel={t('regionalUI.readMore')}
              videoPreviewHiddenLabel={t('regionalUI.videoPreviewHidden')}
              untitledLabel={t('categoryPage.untitled')}
              fallbackCategoryLabel={tHeading(language as any, 'regional')}
            />
          </>
        )}
      </div>

      <DistrictPicker
        open={pickerOpen}
        title={t('regionalUI.chooseDistrictTitle')}
        closeLabel={t('regionalUI.close')}
        closeAriaLabel={t('regionalUI.close')}
        searchPlaceholder={t('regionalUI.typeToSearch')}
        allLabel={t('regionalUI.allGujarat')}
        noResultsLabel={t('regionalUI.noDistrictsFound')}
        districts={localizedDistricts}
        onClose={() => setPickerOpen(false)}
        onPickAll={() => pushPath('/regional/gujarat')}
        onPickDistrict={onSelectDistrict}
      />

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-600">
          {t('regionalGujaratPage.regionalPulse')} – {stateName}
        </div>
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
