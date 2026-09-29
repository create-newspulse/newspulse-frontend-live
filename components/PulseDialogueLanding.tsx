import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, Users, Library, Filter, RefreshCw, X } from 'lucide-react';
import NewsPulseCategoryShell from './NewsPulseCategoryShell';
import { PulseStoryGrid, VoiceCard } from './pulse-dialogue/DiscoveryCards';
import { useI18n } from '../src/i18n/LanguageProvider';
import { normalizeRouteLocale, type RouteLocale } from '../lib/localizedArticleFields';
import { pulseDialogueArchivePath } from '../lib/pulseDialogue';
import { trackDiscoveryClick } from '../lib/analytics/articleAnalytics';
import { EMPTY_PULSE_FILTERS, PULSE_FORMAT_OPTIONS, pulseFilters, pulseArticleQuery, readPulse, uniquePulseStories,
  type PulseCard, type PulseContributor, type PulseSeries, type PulseDiscovery, type PulsePage, type PulseFilters } from '../lib/pulseDialogueDiscovery';

export type PulseLandingProps = { initialItems: PulseCard[]; initialDiscovery: PulseDiscovery | null; initialPage: PulsePage<PulseCard> | null; locale: string; initialErrors?: { articles: boolean; discovery: boolean } };
const control = 'min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-newsPulse-navy focus-visible:ring-2 focus-visible:ring-newsPulse-blue';

function usePulsePage<T extends { slug?: string; _id?: string }>(resource: string, locale: RouteLocale, query: Record<string, string>, initial: PulsePage<T> | null = null, fallback: T[] = [], initialFailed = false) {
  const [items, setItems] = React.useState<T[]>(initial?.items || fallback);
  const [response, setResponse] = React.useState(initial);
  const [page, setPage] = React.useState(1);
  const [revision, setRevision] = React.useState(0);
  const [loading, setLoading] = React.useState(!initial && !initialFailed);
  const [error, setError] = React.useState(initialFailed);
  const queryKey = JSON.stringify(query);
  React.useEffect(() => {
    if ((initial || initialFailed) && page === 1 && revision === 0) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    readPulse<PulsePage<T>>(resource, locale, { ...query, page: String(page), limit: '12' }, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResponse(data);
      setItems((previous) => {
        if (page === 1) return data.items;
        if (resource === 'articles') return uniquePulseStories([...previous, ...data.items] as PulseCard[]) as T[];
        return [...new Map([...previous, ...data.items].map((item) => [item.slug, item])).values()];
      });
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, locale, queryKey, page, revision]);
  React.useEffect(() => {
    if (resource !== 'articles') return;
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden' && page === 1) setRevision((value) => value + 1); }, 60_000);
    return () => clearInterval(timer);
  }, [resource, page]);
  return { items, loading, error, hasMore: Boolean(response?.hasNextPage && page < 1000), next: () => setPage((value) => value + 1), retry: () => setRevision((value) => value + 1) };
}

export function PulseRequestState({ loading, error, empty, retry, errorMessage }: { loading: boolean; error: boolean; empty: boolean; retry: () => void; errorMessage?: string }) {
  const { t } = useI18n();
  const label = (key: string) => t(`pulseDialogue.discovery.${key}`);
  return <>
    {loading ? <div role="status" className="py-4 text-sm text-newsPulse-slate">{label('loading')}</div> : null}
    {error ? <div role={errorMessage ? 'alert' : undefined} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm text-newsPulse-slate">
      {errorMessage ? <span>{errorMessage}</span> : null}<button type="button" onClick={retry} className="inline-flex items-center gap-1 rounded px-1 py-1 text-sm text-newsPulse-navy underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-newsPulse-blue"><RefreshCw size={14} />{label('retry')}</button>
    </div> : !loading && empty ? <p className="py-6 text-newsPulse-slate">{label('empty')}</p> : null}
  </>;
}

function LatestDialogue({ locale, filters, heading, initialPage, initialItems, initialFailed, discoveryError, retryDiscovery }: { locale: RouteLocale; filters: PulseFilters; heading: string; initialPage: PulsePage<PulseCard> | null; initialItems: PulseCard[]; initialFailed: boolean; discoveryError: boolean; retryDiscovery: () => void }) {
  const { t } = useI18n();
  const feed = usePulsePage<PulseCard>('articles', locale, pulseArticleQuery(filters), initialPage, initialItems, initialFailed);
  const retry = () => { feed.retry(); if (discoveryError) retryDiscovery(); };
  return <section aria-labelledby="pulse-latest" className="border-t border-slate-200 py-6">
    <h2 id="pulse-latest" className="mb-4 text-xl font-bold text-newsPulse-navy">{heading}</h2>
    <PulseRequestState {...feed} retry={retry} empty={!feed.items.length} errorMessage={t('pulseDialogue.discovery.latestUnavailable')} />
    <PulseStoryGrid items={uniquePulseStories(feed.items)} locale={locale} />
    {feed.hasMore && !feed.error ? <button type="button" disabled={feed.loading} onClick={feed.next} className={`${control} mt-5 w-full disabled:opacity-50`}>{t('pulseDialogue.discovery.loadMore')}</button> : null}
  </section>;
}

function PulseDirectory({ kind, locale, onFilter, onClose }: { kind: 'contributors' | 'series'; locale: RouteLocale; onFilter: (slug: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const directory = usePulsePage<PulseContributor | PulseSeries>(kind, locale, {});
  const title = t(`pulseDialogue.discovery.${kind}`);
  return <section aria-label={title} className="border-y border-slate-200 py-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2>
      <button type="button" onClick={onClose} title={t('pulseDialogue.discovery.close')} aria-label={t('pulseDialogue.discovery.close')} className={control}><X size={18} /></button></div>
    <PulseRequestState {...directory} empty={!directory.items.length} />
    <div className="grid gap-3 sm:grid-cols-2">{directory.items.map((item) => <div key={item.slug} className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">{kind === 'contributors' ? <VoiceCard contributor={item as PulseContributor} locale={locale} /> :
        <Link href={pulseDialogueArchivePath('series', item.slug, locale)} locale={false} onClick={() => trackDiscoveryClick('series_click', item.slug, locale)}
          className="block min-w-0 break-words rounded-lg border border-slate-200 bg-white p-4 hover:border-newsPulse-blue">
          <span className="block font-bold">{(item as PulseSeries).title}</span>{(item as PulseSeries).description ? <span className="mt-2 block text-sm text-newsPulse-slate">{(item as PulseSeries).description}</span> : null}</Link>}</div>
      <button type="button" className={control} onClick={() => onFilter(item.slug)} title={t('pulseDialogue.discovery.filterBy')} aria-label={`${t('pulseDialogue.discovery.filterBy')} ${'name' in item ? item.name : item.title}`}><Filter size={16} /></button>
    </div>)}</div>
    {directory.hasMore && !directory.error ? <button type="button" disabled={directory.loading} onClick={directory.next} className={`${control} mt-4`}>{t('pulseDialogue.discovery.loadMore')}</button> : null}
  </section>;
}

export default function PulseDialogueLanding({ initialItems, initialDiscovery, initialPage, initialErrors, locale: initialLocale }: PulseLandingProps) {
  const router = useRouter();
  const { t } = useI18n();
  const locale = normalizeRouteLocale(router.locale || initialLocale);
  const label = (key: string) => t(`pulseDialogue.discovery.${key}`);
  const [filters, setFilters] = React.useState<PulseFilters>(() => router.isReady ? pulseFilters(router.query) : EMPTY_PULSE_FILTERS);
  const [draft, setDraft] = React.useState(filters.q);
  const [discovery, setDiscovery] = React.useState(initialDiscovery);
  const [discoveryError, setDiscoveryError] = React.useState(Boolean(initialErrors?.discovery && locale === initialLocale));
  const [revision, setRevision] = React.useState(0);
  const [directory, setDirectory] = React.useState<'contributors' | 'series' | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const filtersButton = React.useRef<HTMLButtonElement>(null);
  const currentFilters = React.useRef(filters);
  currentFilters.current = filters;
  React.useEffect(() => {
    if (!router.isReady) return;
    const next = pulseFilters(router.query);
    setFilters(next); setDraft(next.q);
  }, [router.isReady, router.asPath, locale]);
  React.useEffect(() => {
    setDiscovery(initialDiscovery?.lang === locale ? initialDiscovery : null);
  }, [initialDiscovery, locale]);
  React.useEffect(() => {
    if ((initialDiscovery?.lang === locale || (initialErrors?.discovery && locale === initialLocale)) && revision === 0) return;
    const controller = new AbortController();
    setDiscoveryError(false);
    readPulse<PulseDiscovery>('discovery', locale, {}, controller.signal).then((data) => {
      if (!controller.signal.aborted) setDiscovery(data);
    }).catch(() => { if (!controller.signal.aborted) setDiscoveryError(true); });
    return () => controller.abort();
  }, [locale, revision, initialDiscovery, initialErrors?.discovery, initialLocale]);
  React.useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') setRevision((value) => value + 1); }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const change = (patch: Partial<PulseFilters>) => {
    const next = { ...currentFilters.current, ...patch };
    currentFilters.current = next;
    setFilters(next);
    const query = Object.fromEntries(Object.entries(next).filter(([key, value]) => value && !(key === 'sort' && value === 'newest')));
    void router.replace({ pathname: '/pulse-dialogue', query }, undefined, { shallow: true, scroll: false, locale }).catch(() => {});
  };
  React.useEffect(() => {
    if (draft === filters.q) return;
    const timer = setTimeout(() => change({ q: draft.trim().slice(0, 80) }), 350);
    return () => clearTimeout(timer);
  }, [draft, filters.q]);
  const filtered = Boolean(filters.q || filters.contributor || filters.series || filters.format || filters.sort !== 'newest');
  const selectedFormat = filters.format ? PULSE_FORMAT_OPTIONS.find((option) => filters.format.split(',').every((format) => option.value.split(',').includes(format))) : undefined;
  const heading = <header className="border-b border-slate-200 pb-5 text-newsPulse-navy"><h1 className="text-3xl font-bold">{t('categories.pulseDialogue')}</h1><p className="mt-3 max-w-3xl leading-7 text-newsPulse-slate">{t('pulseDialogue.landing.description')}</p></header>;
  return <>
    <Head><title>{`${t('categories.pulseDialogue')} | News Pulse`}</title><meta name="description" content={t('pulseDialogue.landing.description')} />
      <meta key="pulse-robots" name="robots" content={filtered ? 'noindex, follow' : 'index, follow'} /></Head>
    <NewsPulseCategoryShell activeCategory="pulse-dialogue" latestItems={initialItems} lang={locale} topContent={heading}>
      <div className="min-w-0 text-newsPulse-navy">
        {discovery?.featuredDialogue.length ? <section aria-labelledby="pulse-featured" className="pb-6"><h2 id="pulse-featured" className="mb-4 text-xl font-bold">{t('pulseDialogue.landing.featuredDialogue')}</h2><PulseStoryGrid items={uniquePulseStories(discovery.featuredDialogue)} locale={locale} event="featured_dialogue_click" /></section> : null}
        {discovery?.featuredVoices.length ? <section aria-labelledby="pulse-voices" className="border-t border-slate-200 py-6"><h2 id="pulse-voices" className="mb-4 text-xl font-bold">{label('featuredVoices')}</h2><div className="grid gap-3 sm:grid-cols-2">{discovery.featuredVoices.map((voice) => <VoiceCard key={voice.slug} contributor={voice} locale={locale} featured />)}</div></section> : null}
        <nav aria-label={label('formats')} className="flex flex-wrap gap-2 border-t border-slate-200 py-5">
          <button type="button" aria-pressed={!filters.format} className={`${control} aria-pressed:border-newsPulse-blue aria-pressed:bg-blue-50`} onClick={() => change({ format: '' })}>{label('all')}</button>
          {PULSE_FORMAT_OPTIONS.map((option) => <button type="button" key={option.value} className={`${control} aria-pressed:border-newsPulse-blue aria-pressed:bg-blue-50`} aria-pressed={selectedFormat?.value === option.value} onClick={() => change({ format: option.value })}>{t(option.labelKey)}</button>)}
        </nav>
        <nav aria-labelledby="pulse-explore" className="pb-4">
          <p id="pulse-explore" className="mb-2 text-sm font-medium text-newsPulse-slate">{label('explore')}</p>
          <div className="flex flex-wrap gap-2">
          <button type="button" aria-expanded={directory === 'contributors'} className={`${control} inline-flex items-center gap-2 aria-expanded:border-newsPulse-blue aria-expanded:bg-blue-50`} onClick={() => { setDirectory('contributors'); setFiltersOpen(false); }}><Users size={18} />{label('contributors')}</button>
          <button type="button" aria-expanded={directory === 'series'} className={`${control} inline-flex items-center gap-2 aria-expanded:border-newsPulse-blue aria-expanded:bg-blue-50`} onClick={() => { setDirectory('series'); setFiltersOpen(false); }}><Library size={18} />{label('series')}</button>
          </div>
        </nav>
        {directory ? <PulseDirectory key={`${directory}:${locale}`} kind={directory} locale={locale} onClose={() => setDirectory(null)} onFilter={(slug) => { change(directory === 'contributors' ? { contributor: slug } : { series: slug }); setDirectory(null); }} /> : null}
        <section aria-label={label('filters')} className="py-4" onKeyDown={(event) => { if (event.key === 'Escape' && filtersOpen) { setFiltersOpen(false); filtersButton.current?.focus(); } }}>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <label htmlFor="pulse-search" className="sr-only">{label('search')}</label>
            <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto"><Search size={18} className="pointer-events-none absolute left-3 top-3 text-newsPulse-slate" /><input id="pulse-search" type="search" maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={label('searchPlaceholder')} className={`${control} w-full pl-10`} /></div>
            <button ref={filtersButton} type="button" aria-expanded={filtersOpen} aria-controls="pulse-filter-options" className={`${control} inline-flex shrink-0 items-center gap-2 aria-expanded:border-newsPulse-blue aria-expanded:bg-blue-50`} onClick={() => setFiltersOpen((value) => !value)}><Filter size={16} />{label('filterToggle')}{filters.contributor || filters.series ? <span className="h-1.5 w-1.5 rounded-full bg-newsPulse-blue" aria-hidden="true" /> : null}</button>
            <select aria-label={label('sort')} value={filters.sort} onChange={(event) => change({ sort: event.target.value as PulseFilters['sort'] })} className={`${control} max-w-full`}><option value="newest">{label('newest')}</option><option value="oldest">{label('oldest')}</option></select>
            {filtered ? <button type="button" title={label('clear')} aria-label={label('clear')} onClick={() => { setDraft(''); change(EMPTY_PULSE_FILTERS); }} className={`${control} shrink-0`}><X size={16} /></button> : null}
          </div>
          <div id="pulse-filter-options" hidden={!filtersOpen} className={`mt-3 gap-2 sm:grid-cols-2 ${filtersOpen ? 'grid' : 'hidden'}`}>
            <button type="button" className={`${control} break-words text-left`} onClick={() => { setDirectory('contributors'); setFiltersOpen(false); }}>{label('contributor')}{filters.contributor ? `: ${filters.contributor}` : ''}</button>
            <button type="button" className={`${control} break-words text-left`} onClick={() => { setDirectory('series'); setFiltersOpen(false); }}>{label('series')}{filters.series ? `: ${filters.series}` : ''}</button>
          </div>
        </section>
        <LatestDialogue key={`${locale}:${JSON.stringify(filters)}`} locale={locale} filters={filters}
          heading={t(selectedFormat?.labelKey || 'pulseDialogue.landing.latestContributions')}
          initialPage={!filtered && locale === initialLocale && (!initialPage?.lang || initialPage.lang === locale) ? initialPage : null}
          initialItems={!filtered && locale === initialLocale ? initialItems : []}
          initialFailed={!filtered && locale === initialLocale && Boolean(initialErrors?.articles)}
          discoveryError={discoveryError} retryDiscovery={() => setRevision((value) => value + 1)} />
      </div>
    </NewsPulseCategoryShell>
  </>;
}