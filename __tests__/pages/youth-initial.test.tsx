import { act, cleanup, renderHook } from '@testing-library/react';
import { getServerSideProps } from '../../pages/youth-pulse';
import { useYouthPulse } from '../../features/youthPulse/useYouthPulse';
import { getServerSideProps as getCategoryProps } from '../../pages/youth-pulse/[category]';
let mockLocale = 'en';
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async () => ({}) }));

function story(locale: string, title = 'Youth initial story') {
  return { _id: title, title, summary: 'Summary', slug: 'youth-story', category: 'youth-pulse', language: locale, status: 'published', publishedAt: '2026-01-01T10:00:00Z' };
}
describe('Youth initial loading', () => {
  afterEach(() => { cleanup(); jest.useRealTimers(); });
  test.each(['en', 'hi', 'gu'])('%s SSR seed is locale-correct and avoids a hydration duplicate', async (locale) => {
    mockLocale = locale;
    global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('feature-toggles') ? { youthPulseSubmissionsClosed: true } : { items: [story(locale), story(locale === 'en' ? 'gu' : 'en', 'Wrong locale'), { ...story(locale, 'Draft'), status: 'draft' }] } })) as any;
    const result = await getServerSideProps({ locale, query: {} } as any) as any;
    expect(result.props.initialFounderToggles.youthPulseSubmissionsClosed).toBe(true);
    expect(result.props.initialYouthFeed.stories.map((item: any) => item.title)).toEqual(['Youth initial story']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    (global.fetch as jest.Mock).mockClear();
    const hook = renderHook(() => useYouthPulse(12, result.props.initialYouthFeed));
    expect(hook.result.current.trending[0].title).toBe('Youth initial story');
    expect(hook.result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('stalled stories cannot block SSR past four seconds and preserve quick founder settings', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async (url) => ({ ok: true, json: () => String(url).includes('feature-toggles') ? Promise.resolve({ youthPulseSubmissionsClosed: true }) : new Promise(() => {}) })) as any;
    let completed = false;
    const pending = getServerSideProps({ locale: 'hi', query: {} } as any).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    const result = await pending as any;
    expect(result.props.initialYouthFeed.stories).toEqual([]);
    expect(result.props.initialFounderToggles.youthPulseSubmissionsClosed).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['en', 'hi', 'gu'])('subcategory %s SSR preserves track semantics with one story request', async (locale) => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [
      { ...story(locale, 'Campus story'), tags: ['campus-buzz'] },
      { ...story(locale, 'Exam story'), tags: ['govt-exam-updates'] },
    ] }) })) as any;
    const result = await getCategoryProps({ locale, params: { category: 'campus-buzz' } } as any) as any;
    expect(result.props.initialStories.map((item: any) => item.title)).toEqual(['Campus story']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  test('failed refresh retains the seed and later refresh replaces it', async () => {
    mockLocale = 'en';
    jest.useFakeTimers();
    const initialFeed = { language: 'en', limit: 12, stories: [{ id: 'initial', title: 'Initial story', summary: '', category: 'youth-pulse', image: '', date: '' }] };
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [story('en', 'New story')] }) });
    const hook = renderHook(() => useYouthPulse(12, initialFeed));
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(hook.result.current.trending[0].title).toBe('Initial story');
    expect(hook.result.current.loading).toBe(false);
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(hook.result.current.trending[0].title).toBe('New story');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('stalled founder settings do not discard fast view-all stories', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async (url) => ({ ok: true, json: () => String(url).includes('feature-toggles') ? new Promise(() => {}) : Promise.resolve({ items: [story('gu')] }) })) as any;
    let completed = false;
    const pending = getServerSideProps({ locale: 'gu', query: { view: 'all' } } as any).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(1500);
    expect(completed).toBe(true);
    const result = await pending as any;
    expect(result.props.initialYouthFeed.stories).toHaveLength(1);
    expect(result.props.initialYouthFeed.limit).toBe(30);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });
});