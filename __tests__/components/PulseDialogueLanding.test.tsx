import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PulseDialogueLanding from '../../components/PulseDialogueLanding';
import RelatedContributions from '../../components/pulse-dialogue/RelatedContributions';
import { readPulse, type PulseCard, type PulseDiscovery } from '../../lib/pulseDialogueDiscovery';
import { trackDiscoveryClick } from '../../lib/analytics/articleAnalytics';
import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';

let mockDictionaryLocale: 'en' | 'hi' | 'gu' = 'en';
const mockDictionaries = { en, hi, gu };
const mockRouter = { locale: 'en', isReady: true, asPath: '/pulse-dialogue', query: {} as Record<string, string>, replace: jest.fn(async () => true) };
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({ __esModule: true, default: ({ children, topContent }: any) => <>{topContent}<main>{children}</main></> }));
jest.mock('../../src/components/story/StoryImage', () => ({ __esModule: true, default: ({ alt }: any) => <img alt={alt} />, TopStoryImage: ({ alt }: any) => <img alt={alt} /> }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ useI18n: () => ({ t: (key: string) => key.split('.').reduce((value: any, part: string) => value?.[part], mockDictionaries[mockDictionaryLocale]) || key }) }));
jest.mock('../../lib/pulseDialogueDiscovery', () => ({ ...jest.requireActual('../../lib/pulseDialogueDiscovery'), readPulse: jest.fn() }));
jest.mock('../../lib/analytics/articleAnalytics', () => ({ trackDiscoveryClick: jest.fn() }));

const story = (id: string, extra = {}): PulseCard => ({ _id: id, title: id, slug: id, category: 'pulse-dialogue', language: 'en', status: 'published', publishedAt: '2026-01-01T00:00:00Z', ...extra });
const page = (items: any[] = [], extra = {}) => ({ ok: true as const, lang: mockRouter.locale as any, items, page: 1, limit: 12, total: items.length, count: items.length, totalPages: 1, hasNextPage: false, ...extra });
const emptyDiscovery = (): PulseDiscovery => ({ ok: true, lang: mockRouter.locale as any, featuredDialogue: [], featuredVoices: [], formatGroups: { columns: [], essays: [], culture: [], conversations: [] } });
const voice = (slug: string) => ({ slug, name: slug, publicDesignation: null, photoUrl: null, shortBio: null });
function show(overrides: Record<string, unknown> = {}) {
  return render(<PulseDialogueLanding locale={mockRouter.locale} initialItems={[story('latest')]} initialPage={page([story('latest')])} initialDiscovery={emptyDiscovery()} {...overrides} />);
}
beforeEach(() => {
  mockDictionaryLocale = 'en';
  jest.clearAllMocks(); mockRouter.locale = 'en'; mockRouter.asPath = '/pulse-dialogue'; mockRouter.query = {};
  (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'discovery' ? emptyDiscovery() : page());
});
afterEach(() => jest.useRealTimers());

test('renders Backend curated order without substituting latest, and records article clicks', () => {
  show({ initialDiscovery: { ...emptyDiscovery(), featuredDialogue: [story('chosen-second'), story('chosen-first')] } });
  const section = screen.getByRole('region', { name: 'Featured Dialogue' });
  expect(within(section).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['chosen-second', 'chosen-first']);
  expect(within(section).queryByText('latest')).toBeNull();
  fireEvent.click(within(section).getAllByRole('link')[0]);
  expect(trackDiscoveryClick).toHaveBeenCalledWith('featured_dialogue_click', 'chosen-second', 'en');
});
test('hides empty featured sections and does not request directories on mount', () => {
  show(); expect(screen.queryByRole('region', { name: 'Featured Dialogue' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Featured Voices' })).toBeNull(); expect(readPulse).not.toHaveBeenCalled();
});
test('renders featured voices in order with no invalid portrait placeholders', () => {
  show({ initialDiscovery: { ...emptyDiscovery(), featuredVoices: [{ ...voice('second'), photoUrl: 'javascript:alert(1)' }, voice('first')] } });
  const section = screen.getByRole('region', { name: 'Featured Voices' });
  expect(within(section).getAllByRole('link').map((link) => link.textContent)).toEqual(['second', 'first']);
  expect(within(section).queryByRole('img')).toBeNull();
  fireEvent.click(within(section).getAllByRole('link')[0]);
  expect(trackDiscoveryClick).toHaveBeenCalledWith('featured_voice_click', 'second', 'en');
});
test.each([
  ['Columns', 'column,guest_column'], ['Essays', 'essay,literary_essay'], ['Culture', 'culture_ideas'],
  ['Conversations', 'conversation,interview'], ['Viewpoint', 'viewpoint'], ['Expert Perspective', 'expert_perspective'], ['Open Letter', 'open_letter'],
])('%s tab sends its exact mapping, preserves filters, and becomes active', async (label, format) => {
  mockRouter.query = { q: 'heritage', contributor: 'writer', series: 'ideas', sort: 'oldest' };
  mockRouter.asPath += '?q=heritage';
  show(); await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  const tabs = screen.getByRole('navigation', { name: 'Content format' });
  fireEvent.click(within(tabs).getByRole('button', { name: label }));
  await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(2));
  expect(readPulse).toHaveBeenLastCalledWith('articles', 'en', { q: 'heritage', contributor: 'writer', seriesSlug: 'ideas', sort: 'oldest', dialogueFormat: format, page: '1', limit: '12' }, expect.anything());
  expect(mockRouter.replace).toHaveBeenLastCalledWith(expect.objectContaining({ query: { q: 'heritage', contributor: 'writer', series: 'ideas', sort: 'oldest', format } }), undefined, expect.objectContaining({ shallow: true }));
  expect(within(tabs).getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual([label]);
  expect(screen.queryByRole('combobox', { name: 'Content format' })).toBeNull();
});
test('uses discovery format previews without per-preview fetches', () => {
  show({ initialDiscovery: { ...emptyDiscovery(), formatGroups: { ...emptyDiscovery().formatGroups, essays: [story('preview-essay')] } } });
  expect(screen.getByText('preview-essay')).toBeTruthy(); expect(readPulse).not.toHaveBeenCalled();
});
test.each(['en', 'hi', 'gu'] as const)('separates eight format tabs from localized Explore controls in %s', (locale) => {
  mockDictionaryLocale = locale; mockRouter.locale = locale;
  const { discovery, formats } = mockDictionaries[locale].pulseDialogue;
  show();
  const tabs = screen.getByRole('navigation', { name: discovery.formats });
  expect(within(tabs).getAllByRole('button').map((button) => button.textContent)).toEqual([
    discovery.all, discovery.columns, discovery.essays, discovery.culture, discovery.conversations,
    formats.viewpoint, formats.expertPerspective, formats.openLetter,
  ]);
  expect(within(tabs).queryByRole('button', { name: discovery.contributors })).toBeNull();
  expect(within(tabs).queryByRole('button', { name: discovery.series })).toBeNull();
  const explore = screen.getByRole('navigation', { name: discovery.explore });
  expect(within(explore).getByText(discovery.explore).className).toContain('text-sm');
  expect(within(explore).getAllByRole('button').map((button) => button.textContent)).toEqual([discovery.contributors, discovery.series]);
  expect(tabs.nextElementSibling).toBe(explore);
  expect(screen.queryByRole('combobox', { name: discovery.formats })).toBeNull();
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  expect(screen.getByRole('button', { name: discovery.filterToggle }).getAttribute('aria-expanded')).toBe('false');
  expect(within(screen.getByRole('combobox', { name: discovery.sort })).getAllByRole('option').map((option) => option.textContent)).toEqual([discovery.newest, discovery.oldest]);
  const toolbar = screen.getByRole('region', { name: discovery.filters });
  expect(explore.nextElementSibling).toBe(toolbar);
  expect(within(toolbar).queryByRole('button', { name: discovery.contributor })).toBeNull();
  expect(within(toolbar).queryByRole('button', { name: discovery.series })).toBeNull();
  expect(toolbar.nextElementSibling).toBe(screen.getByRole('region', { name: mockDictionaries[locale].pulseDialogue.landing.latestContributions }));
  expect(screen.queryByRole('navigation', { name: discovery.browse })).toBeNull();
  expect(within(tabs).getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual([discovery.all]);
  for (const button of within(tabs).getAllByRole('button').slice(0, 8)) {
    expect(button.className).toContain('aria-pressed:border-newsPulse-blue');
    expect(button.className).toContain('aria-pressed:bg-blue-50');
  }
});
test('Filters toggles safely without fetching, closes on Escape, and restores focus', () => {
  show();
  const toolbar = screen.getByRole('region', { name: 'Search and filters' });
  const toggle = within(toolbar).getByRole('button', { name: 'Filters' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(within(toolbar).getByRole('button', { name: 'Contributor' })).toBeTruthy();
  expect(within(toolbar).getByRole('button', { name: 'Series / Columns' })).toBeTruthy();
  fireEvent.click(toggle);
  expect(within(toolbar).queryByRole('button', { name: 'Contributor' })).toBeNull();
  fireEvent.click(toggle);
  const contributor = within(toolbar).getByRole('button', { name: 'Contributor' });
  contributor.focus(); fireEvent.keyDown(contributor, { key: 'Escape' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(toggle);
  expect(readPulse).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
test.each(['en', 'hi', 'gu'] as const)('hidden Contributor and Series filters combine with search, format, and sort in %s', async (locale) => {
  mockDictionaryLocale = locale; mockRouter.locale = locale;
  const labels = mockDictionaries[locale].pulseDialogue.discovery;
  mockRouter.query = { q: 'heritage', format: 'open_letter', sort: 'oldest' }; mockRouter.asPath += '?format=open_letter';
  (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'contributors' ? page([voice('writer')]) : resource === 'series' ? page([{ slug: 'ideas', title: 'Ideas', description: null }]) : page());
  show(); await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  const toolbar = screen.getByRole('region', { name: labels.filters });
  fireEvent.click(within(toolbar).getByRole('button', { name: labels.filterToggle }));
  fireEvent.click(within(toolbar).getByRole('button', { name: labels.contributor }));
  fireEvent.click(await screen.findByRole('button', { name: `${labels.filterBy} writer` }));
  await waitFor(() => expect(readPulse).toHaveBeenLastCalledWith('articles', locale, { q: 'heritage', dialogueFormat: 'open_letter', contributor: 'writer', sort: 'oldest', page: '1', limit: '12' }, expect.anything()));
  fireEvent.click(within(toolbar).getByRole('button', { name: labels.filterToggle }));
  fireEvent.click(within(toolbar).getByRole('button', { name: labels.series }));
  fireEvent.click(await screen.findByRole('button', { name: `${labels.filterBy} Ideas` }));
  await waitFor(() => expect(readPulse).toHaveBeenLastCalledWith('articles', locale, { q: 'heritage', dialogueFormat: 'open_letter', contributor: 'writer', seriesSlug: 'ideas', sort: 'oldest', page: '1', limit: '12' }, expect.anything()));
  expect(mockRouter.replace).toHaveBeenLastCalledWith(expect.objectContaining({ query: { q: 'heritage', format: 'open_letter', contributor: 'writer', series: 'ideas', sort: 'oldest' } }), undefined, expect.anything());
  expect(within(toolbar).getByRole('button', { name: labels.filterToggle }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.getAllByRole('button', { name: labels.series })).toHaveLength(1);
});
test('All / Latest clears only format and retains other filters', async () => {
  mockRouter.query = { q: 'heritage', format: 'essay', contributor: 'writer', series: 'ideas', sort: 'oldest' }; mockRouter.asPath += '?format=essay';
  show(); await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Essays' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'All / Latest' }));
  await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(2));
  expect(readPulse).toHaveBeenLastCalledWith('articles', 'en', { q: 'heritage', contributor: 'writer', seriesSlug: 'ideas', page: '1', limit: '12', sort: 'oldest' }, expect.anything());
  expect(mockRouter.replace).toHaveBeenLastCalledWith(expect.objectContaining({ query: { q: 'heritage', contributor: 'writer', series: 'ideas', sort: 'oldest' } }), undefined, expect.anything());
  const tabs = screen.getByRole('navigation', { name: 'Content format' });
  expect(within(tabs).getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual(['All / Latest']);
});
test.each([['Contributors', 'contributors'], ['Series / Columns', 'series']])('%s navigation opens only its directory without changing the selected format or filters', async (label, resource) => {
  mockRouter.query = { q: 'heritage', format: 'open_letter', contributor: 'writer', series: 'ideas', sort: 'oldest' };
  mockRouter.asPath += '?format=open_letter';
  show(); await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  const tabs = screen.getByRole('navigation', { name: 'Content format' });
  const explore = screen.getByRole('navigation', { name: 'Explore Pulse Dialogue' });
  const button = within(explore).getByRole('button', { name: label });
  fireEvent.click(button);
  await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(2));
  expect(readPulse).toHaveBeenLastCalledWith(resource, 'en', { page: '1', limit: '12' }, expect.anything());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(within(tabs).getByRole('button', { name: 'Open Letter' }).getAttribute('aria-pressed')).toBe('true');
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(button.className).toContain('aria-expanded:bg-blue-50');
  expect(screen.queryByRole('combobox', { name: 'Content format' })).toBeNull();
  fireEvent.click(button);
  expect(readPulse).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(readPulse).toHaveBeenCalledTimes(2);
});
test('loads the contributor directory once and combines its canonical filter', async () => {
  (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'contributors' ? page([voice('writer')]) : page());
  show(); fireEvent.click(screen.getByRole('button', { name: 'Contributors' }));
  const profile = await screen.findByRole('link', { name: 'writer' });
  expect(profile.getAttribute('href')).toBe('/pulse-dialogue/contributors/writer');
  fireEvent.click(profile); expect(trackDiscoveryClick).toHaveBeenCalledWith('contributor_profile_click', 'writer', 'en');
  fireEvent.click(screen.getByRole('button', { name: 'Filter by writer' }));
  await waitFor(() => expect(readPulse).toHaveBeenCalledWith('articles', 'en', expect.objectContaining({ contributor: 'writer' }), expect.anything()));
  expect((readPulse as jest.Mock).mock.calls.filter(([resource]) => resource === 'contributors')).toHaveLength(1);
});
test('uses directory Series slugs rather than deriving from titles', async () => {
  (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'series' ? page([{ slug: 'canonical-series', title: 'Different visible title', description: null }]) : page());
  show(); fireEvent.click(screen.getAllByRole('button', { name: 'Series / Columns' })[0]);
  const link = await screen.findByRole('link', { name: 'Different visible title' });
  expect(link.getAttribute('href')).toBe('/pulse-dialogue/series/canonical-series');
  fireEvent.click(link); expect(trackDiscoveryClick).toHaveBeenCalledWith('series_click', 'canonical-series', 'en');
  fireEvent.click(screen.getByRole('button', { name: 'Filter by Different visible title' }));
  await waitFor(() => expect(readPulse).toHaveBeenCalledWith('articles', 'en', expect.objectContaining({ seriesSlug: 'canonical-series' }), expect.anything()));
});
test('debounces Pulse-only search and clearing restores browsing', async () => {
  jest.useFakeTimers(); show();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'heritage' } });
  expect(readPulse).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(350); });
  expect(readPulse).toHaveBeenCalledWith('articles', 'en', expect.objectContaining({ q: 'heritage', limit: '12' }), expect.anything());
  expect((readPulse as jest.Mock).mock.calls.every(([resource]) => resource === 'articles')).toBe(true);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  await act(async () => { jest.advanceTimersByTime(350); });
  expect(screen.getByText('latest')).toBeTruthy();
});
test('ignores stale search responses and aborts old requests', async () => {
  jest.useFakeTimers(); let resolveOld!: (value: any) => void;
  (readPulse as jest.Mock).mockImplementation((_resource, _locale, query) => query.q === 'old' ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(page([story('fresh-result')])));
  show(); fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'old' } });
  await act(async () => { jest.advanceTimersByTime(350); });
  const oldSignal = (readPulse as jest.Mock).mock.calls[0][3];
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } });
  await act(async () => { jest.advanceTimersByTime(350); });
  await act(async () => resolveOld(page([story('stale-result')])));
  expect(oldSignal.aborted).toBe(true); expect(screen.queryByText('stale-result')).toBeNull(); expect(screen.getByText('fresh-result')).toBeTruthy();
});
test.each(['en', 'hi', 'gu'])('combines URL filters, uses %s, and noindexes filtered results', async (locale) => {
  mockRouter.locale = locale; mockRouter.query = { q: 'heritage', contributor: 'writer', series: 'ideas', format: 'essay', sort: 'oldest' }; mockRouter.asPath += '?q=heritage';
  show();
  await waitFor(() => expect(readPulse).toHaveBeenCalledWith('articles', locale, { q: 'heritage', contributor: 'writer', seriesSlug: 'ideas', dialogueFormat: 'essay', sort: 'oldest', page: '1', limit: '12' }, expect.anything()));
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'newest' } });
  await waitFor(() => expect(readPulse).toHaveBeenLastCalledWith('articles', locale, expect.objectContaining({ sort: 'newest', contributor: 'writer' }), expect.anything()));
});
test('Sort switches both directions without clearing search, contributor, series, or format', async () => {
  mockRouter.query = { q: 'heritage', contributor: 'writer', series: 'ideas', format: 'viewpoint' }; mockRouter.asPath += '?format=viewpoint';
  show(); await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  for (const sort of ['oldest', 'newest']) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: sort } });
    await waitFor(() => expect(readPulse).toHaveBeenLastCalledWith('articles', 'en', { q: 'heritage', contributor: 'writer', seriesSlug: 'ideas', dialogueFormat: 'viewpoint', page: '1', limit: '12', sort }, expect.anything()));
  }
});
test.each(['en', 'hi', 'gu'] as const)('renders one localized neutral Latest error in %s even if a directory also fails', async (locale) => {
  mockDictionaryLocale = locale; mockRouter.locale = locale;
  const labels = mockDictionaries[locale].pulseDialogue.discovery;
  (readPulse as jest.Mock).mockRejectedValue(new Error('offline'));
  const view = show({ initialPage: null, initialItems: [], initialDiscovery: null, initialErrors: { articles: true, discovery: true } });
  const latest = screen.getByRole('region', { name: mockDictionaries[locale].pulseDialogue.landing.latestContributions });
  const alert = within(latest).getByRole('alert');
  expect(within(alert).getByText(labels.latestUnavailable)).toBeTruthy();
  expect(within(alert).getByRole('button', { name: labels.retry })).toBeTruthy();
  expect(alert.className).toContain('text-sm');
  expect(alert.className).not.toMatch(/amber|yellow|bg-|border/);
  fireEvent.click(within(screen.getByRole('navigation', { name: labels.explore })).getByRole('button', { name: labels.contributors }));
  const directory = await screen.findByRole('region', { name: labels.contributors });
  await within(directory).findByRole('button', { name: labels.retry });
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText(mockDictionaries[locale].pulseDialogue.archive.unavailable)).toBeNull();
  expect(view.container.querySelector('[class*="amber"]')).toBeNull();
});
test('loads bounded pages and retains existing stories on failure with retry', async () => {
  (readPulse as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([story('next-page')], { page: 2 }));
  show({ initialPage: page([story('latest')], { hasNextPage: true, totalPages: 2 }) });
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByRole('alert'); expect(screen.getByText('latest')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('next-page');
  expect(readPulse).toHaveBeenLastCalledWith('articles', 'en', expect.objectContaining({ page: '2', limit: '12' }), expect.anything());
});
test('discovery outage does not remove latest content; directory empty state is safe', async () => {
  (readPulse as jest.Mock).mockImplementation(async (resource) => { if (resource === 'discovery') throw new Error('offline'); return page(); });
  show({ initialDiscovery: null }); await act(async () => {}); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('latest')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Featured Dialogue: Retry' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Contributors' })); await screen.findByText('No results found.');
});

test.each(['en', 'hi', 'gu'])('settled %s server failures make no hydration requests and one Retry recovers both resources', async (locale) => {
  mockRouter.locale = locale;
  (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'discovery'
    ? { ...emptyDiscovery(), featuredDialogue: [story('recovered-feature')] }
    : page([story('recovered-latest')]));
  show({ initialItems: [], initialPage: null, initialDiscovery: null, initialErrors: { articles: true, discovery: true } });
  expect(readPulse).not.toHaveBeenCalled();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getAllByText(en.pulseDialogue.discovery.latestUnavailable)).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(1);
  expect(screen.getByRole('searchbox')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Contributors' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('recovered-feature'); await screen.findByText('recovered-latest');
  expect(screen.queryByRole('alert')).toBeNull();
  expect((readPulse as jest.Mock).mock.calls.map(([resource]) => resource).sort()).toEqual(['articles', 'discovery']);
});
test('discovery-only outage hides missing curation and leaves authoritative Latest untouched', () => {
  show({ initialItems: [story('legacy-fallback')], initialDiscovery: null, initialErrors: { articles: false, discovery: true } });
  expect(screen.getByText('latest')).toBeTruthy(); expect(screen.queryByText('legacy-fallback')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull(); expect(readPulse).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Featured Dialogue' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Featured Voices' })).toBeNull();
});
test('Latest-only failure retains discovery and optional usable items, and Retry replaces them from articles', async () => {
  (readPulse as jest.Mock).mockResolvedValue(page([story('authoritative')]));
  show({ initialPage: null, initialDiscovery: { ...emptyDiscovery(), featuredDialogue: [story('curated')] }, initialErrors: { articles: true, discovery: false } });
  expect(screen.getByText('curated')).toBeTruthy(); expect(screen.getByText('latest')).toBeTruthy();
  expect(screen.getAllByRole('alert')).toHaveLength(1); expect(readPulse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('authoritative'); expect(screen.queryByText('latest')).toBeNull();
  expect((readPulse as jest.Mock).mock.calls.map(([resource]) => resource)).toEqual(['articles']);
});
test('real transport rejects safely when the local Backend is absent, and Retry recovers', async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED localhost:3010'));
  (readPulse as jest.Mock).mockImplementation(jest.requireActual('../../lib/pulseDialogueDiscovery').readPulse);
  try {
    show({ initialItems: [], initialPage: null, initialDiscovery: null });
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch as jest.Mock).mock.calls.every(([url]) => String(url).startsWith('/api/public/pulse-dialogue/'))).toBe(true);
    (fetch as jest.Mock).mockImplementation(async (url) => ({ ok: true, json: async () => String(url).includes('/discovery?') ? emptyDiscovery() : page([story('online-again')]) }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('online-again'); expect(screen.queryByRole('alert')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  } finally { global.fetch = previousFetch; }
});
test('background failures retain cached discovery and Latest with only one primary alert', async () => {
  jest.useFakeTimers(); (readPulse as jest.Mock).mockRejectedValue(new Error('offline'));
  show({ initialDiscovery: { ...emptyDiscovery(), featuredDialogue: [story('cached-feature')] } });
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(screen.getByText('cached-feature')).toBeTruthy(); expect(screen.getByText('latest')).toBeTruthy();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect((readPulse as jest.Mock).mock.calls.map(([resource]) => resource).sort()).toEqual(['articles', 'discovery']);
});
test('does not refetch valid server article pages whose optional lang is absent', () => {
  show({ initialPage: page([story('latest')], { lang: undefined }) });
  expect(readPulse).not.toHaveBeenCalled(); expect(screen.getByText('latest')).toBeTruthy();
});
test('a filtered initial URL requests only its own articles, not an extra default feed', async () => {
  mockRouter.query = { format: 'essay' }; mockRouter.asPath += '?format=essay';
  show({ initialPage: null, initialItems: [] });
  await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(1));
  expect(readPulse).toHaveBeenCalledWith('articles', 'en', expect.objectContaining({ dialogueFormat: 'essay' }), expect.anything());
});
test.each(['en', 'hi', 'gu'])('deduplicates each %s section by canonical identity while preserving manual order and cross-section curation', (locale) => {
  mockRouter.locale = locale;
  const shared = story('chosen-first', { translationKey: 'shared' });
  const edition = story('translated-edition', { translationGroupId: 'shared', language: locale });
  const second = story('chosen-second');
  const items = [shared, edition, second, shared];
  show({ initialPage: page(items), initialDiscovery: { ...emptyDiscovery(), featuredDialogue: items,
    formatGroups: { columns: items, essays: items, culture: items, conversations: items } } });
  for (const name of ['Featured Dialogue', 'Columns', 'Essays', 'Culture', 'Conversations', 'Latest Contributions']) {
    const section = screen.getByRole('region', { name });
    expect(within(section).getAllByRole('heading', { level: 3 }).map((node) => node.textContent).filter((text) => text !== name)).toEqual(['chosen-first', 'chosen-second']);
    expect(within(section).queryByText('translated-edition')).toBeNull();
  }
  expect(screen.getAllByText('chosen-first')).toHaveLength(6);
  expect(readPulse).not.toHaveBeenCalled();
});

test('related archives exclude current translation, generic stories, and duplicates across sections', async () => {
  const article = story('current', { translationKey: 'current-group', pulseDialogue: { contributorSlug: 'writer', profileAvailable: true, seriesSlug: 'ideas', bylineSnapshot: { name: 'Historical Writer' } } });
  (readPulse as jest.Mock).mockImplementation(async (resource) => page(resource.startsWith('contributors')
    ? [story('current-hi', { translationGroupId: 'current-group' }), story('voice-story', { translationKey: 'voice-group' }), story('generic')]
    : [story('voice-gu', { translationKey: 'voice-group' }), story('series-story')]));
  render(<RelatedContributions article={article} locale="hi" excludedStories={[story('generic')]} />);
  await screen.findByText('voice-story'); await screen.findByText('series-story');
  expect(screen.queryByText('current-hi')).toBeNull(); expect(screen.queryByText('voice-gu')).toBeNull(); expect(screen.queryByText('generic')).toBeNull();
  expect(readPulse).toHaveBeenCalledWith('contributors/writer/articles', 'hi', { page: '1', limit: '4' }, expect.anything());
  expect(readPulse).toHaveBeenCalledWith('series/ideas/articles', 'hi', { page: '1', limit: '4' }, expect.anything());
  expect(article.pulseDialogue?.bylineSnapshot?.name).toBe('Historical Writer');
});
test('does not fetch related data without public associations or infer Series slugs', () => {
  const view = render(<RelatedContributions article={story('current', { pulseDialogue: { series: 'Visible title', profileAvailable: false } })} locale="en" />);
  expect(readPulse).not.toHaveBeenCalled(); expect(view.container.textContent).toBe('');
});
test('hidden Series and empty contributor archives do not render empty sections', async () => {
  (readPulse as jest.Mock).mockImplementation(async (resource) => { if (resource.startsWith('series')) throw Object.assign(new Error('hidden'), { status: 404 }); return page(); });
  const view = render(<RelatedContributions article={story('current', { pulseDialogue: { contributorSlug: 'writer', profileAvailable: true, seriesSlug: 'hidden' } })} locale="en" />);
  await waitFor(() => expect(readPulse).toHaveBeenCalledTimes(2)); expect(view.container.textContent).toBe('');
});