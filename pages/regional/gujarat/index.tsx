import Head from 'next/head';
import React from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

import DistrictChipBar from '../../../components/regional/DistrictChipBar';
import DistrictPicker from '../../../components/regional/DistrictPicker';
import CategoryRail from '../../../components/regional/CategoryRail';
import RegionalTabs, { type RegionalTabKey } from '../../../components/regional/RegionalTabs';
import BreakingTicker from '../../../components/regional/BreakingTicker';
import RegionalHomeStorySections from '../../../components/regional/RegionalHomeStorySections';
import NewsPulseCategoryShell from '../../../components/NewsPulseCategoryShell';

import { getStoryCategoryLabel } from '../../../lib/publicStories';
import { GUJARAT_DISTRICTS } from '../../../utils/regions';
import { useLanguage } from '../../../utils/LanguageContext';
import { getGujaratDistrictName, getStateName, tHeading, toLanguageKey } from '../../../utils/localizedNames';
import { normalizeLang, useI18n } from '../../../src/i18n/LanguageProvider';
import { getActiveRouteLang } from '../../../utils/routeLang';
import { unwrapRegionalFeedItems } from '../../../lib/unwrapRegionalFeed';
import { buildRegionalFeedSearchParams } from '../../../lib/regionalFeedQuery';

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

const REGIONAL_FEED_BATCH_SIZE = 30;

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
  const direct =
    story?.district ||
    story?.districtName ||
    story?.location?.district ||
    story?.geo?.district ||
    story?.region?.district ||
    '';
  const directValue = String(direct || '').trim();
  if (directValue) return directValue;

  const tags = tagList(story?.tags);
  for (const t of tags) {
    if (t.startsWith('district:')) return String(t.slice('district:'.length) || '').trim();
    if (t.startsWith('district-')) return String(t.slice('district-'.length) || '').trim();
    if (t.startsWith('district=')) return String(t.slice('district='.length) || '').trim();
  }

  return '';
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

function regionalStoryKey(story: AnyStory): string {
  return String(story?._id || story?.id || story?.slug || '').trim().toLowerCase();
}

function dedupeRegionalStories(stories: AnyStory[]): AnyStory[] {
  const seen = new Set<string>();
  const output: AnyStory[] = [];

  for (const story of Array.isArray(stories) ? stories : []) {
    const key = regionalStoryKey(story);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    output.push(story);
  }

  return output;
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
    const active = getActiveRouteLang(router.asPath);
    // Priority: active route prefix -> query (rare; used by some rewrites) -> route locale -> persisted/provider language
    return normalizeLang(active || queryLang || router.locale || language || 'en');
  }, [language, queryLang, router.asPath, router.locale]);

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
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const loadingPageRef = React.useRef<number | null>(null);
  const activeFeedRequestRef = React.useRef('');
  const inFlightFeedRequestRef = React.useRef('');

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

  const regionalFeedFilterKey = React.useMemo(
    () => `${uiLang}:${effectiveCategory}:${normalize(searchQuery)}`,
    [effectiveCategory, searchQuery, uiLang]
  );

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

  const fetchRegionalPage = React.useCallback(async (pageToLoad: number) => {
    const requestedLimit = pageToLoad * REGIONAL_FEED_BATCH_SIZE;
    const requestKey = `${regionalFeedFilterKey}:${refreshNonce}:${pageToLoad}`;
    if (inFlightFeedRequestRef.current === requestKey) return;

    loadingPageRef.current = pageToLoad;
    activeFeedRequestRef.current = requestKey;
    inFlightFeedRequestRef.current = requestKey;

    if (pageToLoad === 1) {
      setLoading(true);
      setError(null);
      setLoadMoreError(null);
      setHasMore(true);
      setPage(1);
    } else {
      setLoadingMore(true);
      setLoadMoreError(null);
    }

    const debugRegional =
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debugRegional') === '1';

    try {
      const params = buildRegionalFeedSearchParams({ state: 'gujarat', lang: uiLang });
      params.set('limit', String(requestedLimit));
      if (effectiveCategory !== 'All') params.set('topic', normalize(effectiveCategory));
      const query = String(searchQuery || '').trim();
      if (query) params.set('q', query);

      const url = `/api/public/regional?${params.toString()}`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Failed to fetch regional feed (${res.status})`);

      const data = await res.json().catch(() => null);
      if (activeFeedRequestRef.current !== requestKey) return;

      if (debugRegional) {
        // eslint-disable-next-line no-console
        console.log('[regional/gujarat] feed debug', {
          url,
          status: res.status,
          cacheControl: res.headers.get('cache-control'),
          age: res.headers.get('age'),
          xVercelCache: res.headers.get('x-vercel-cache'),
          payload: data,
        });
      }

      const items = dedupeRegionalStories(unwrapRegionalFeedItems(data) as AnyStory[]);
      setStories(items);
      setPage(pageToLoad);
      setHasMore(items.length >= requestedLimit);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch regional feed', e);
      if (activeFeedRequestRef.current !== requestKey) return;
      const message = e?.message || t('regionalUI.failedToLoadStories');
      if (pageToLoad === 1) setError(message);
      else {
        setLoadMoreError(message);
        setHasMore(true);
      }
    } finally {
      if (activeFeedRequestRef.current === requestKey) {
        setLoading(false);
        setLoadingMore(false);
      }
      if (loadingPageRef.current === pageToLoad) loadingPageRef.current = null;
      if (inFlightFeedRequestRef.current === requestKey) inFlightFeedRequestRef.current = '';
    }
  }, [effectiveCategory, refreshNonce, regionalFeedFilterKey, searchQuery, t, uiLang]);

  React.useEffect(() => {
    fetchRegionalPage(1);
  }, [fetchRegionalPage]);

  const loadNextRegionalPage = React.useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchRegionalPage(page + 1);
  }, [fetchRegionalPage, hasMore, loading, loadingMore, page]);

  const filteredStories = React.useMemo(() => {
    let list = stories;

    if (effectiveCategory !== 'All') {
      const wanted = normalize(effectiveCategory);
      list = list.filter((s) => normalize(extractCategory(s)).includes(wanted));
    }

    const q = normalize(searchQuery);
    if (q) {
      list = list.filter((s) => {
        const hay = normalize(`${s?.title || ''} ${s?.summary || ''} ${s?.excerpt || ''} ${s?.content || ''}`);
        return hay.includes(q);
      });
    }

    return list;
  }, [stories, effectiveCategory, searchQuery]);

  const regionalTickerItems = React.useMemo(
    () =>
      (Array.isArray(stories) ? stories : [])
        .map((story) => ({
          _id: String(story?._id || story?.id || story?.slug || '').trim(),
          title: String(story?.title || story?.headline || story?.shortTitle || '').trim(),
          category: story?.category,
          tags: story?.tags,
          createdAt: story?.createdAt,
          publishedAt: story?.publishedAt,
        }))
        .filter((story) => story._id && story.title)
        .slice(0, 12),
    [stories]
  );

  const stateName = getStateName(langKey, 'gujarat', 'Gujarat');

  const regionalLoadMoreLabel = React.useMemo(() => {
    const contextLabel = effectiveCategory === 'All' ? stateName : tTopicChip(effectiveCategory);
    return `Load More ${contextLabel} Stories`;
  }, [effectiveCategory, stateName]);

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

  const regionalTopControls = (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-newsPulse-blue/80">
              {tHeading(language as any, 'regional')} {t('regionalGujaratPage.feedWord')} • {stateName}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-newsPulse-navy sm:text-3xl">
              {t('regionalGujaratPage.regionalPulse')} – {stateName}
            </h1>
          </div>

          <div className="w-full md:max-w-[340px]">
            <div className="relative w-full">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('regionalGujaratPage.searchPlaceholder')}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
              <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</div>
            </div>
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
  );

  return (
    <>
      <Head>
        <title>{t('regionalGujaratPage.headTitle')}</title>
        <meta name="description" content={t('regionalGujaratPage.headDescription')} />
      </Head>

      <NewsPulseCategoryShell
        activeCategory="regional"
        latestItems={stories}
        lang={uiLang}
        tickerContent={(
          <BreakingTicker
            items={regionalTickerItems}
            variant="breaking"
            label="REGIONAL UPDATES"
            emptyText="No regional updates right now."
            viewAllHref="/regional/gujarat"
            className="overflow-hidden rounded-xl border-0"
          />
        )}
        topContent={regionalTopControls}
      >
      <div className="min-w-0 text-slate-900">
      <div className="py-4">
        {!!error && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">{error}</div>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Retry
            </button>
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
            <RegionalHomeStorySections
              stories={filteredStories}
              requestedLang={uiLang}
              loading={loading}
              stateName={stateName}
              categoryLabel={`${t('regionalGujaratPage.latestFrom')} ${stateName}`}
              showDistrictBadges={districtFilteringEnabled}
              getDistrictLabel={getLocalizedDistrictFromStory}
              emptyTitle={t('regionalUI.emptyTitle')}
              emptyHint={t('regionalUI.emptyHint')}
              readMoreLabel={t('regionalUI.readMore')}
              loadMoreLabel={regionalLoadMoreLabel}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMoreError={loadMoreError}
              onLoadMore={loadNextRegionalPage}
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
      </NewsPulseCategoryShell>
    </>
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
