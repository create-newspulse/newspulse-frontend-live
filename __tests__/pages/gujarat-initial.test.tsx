import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import GujaratPage, { getStaticProps } from '../../pages/regional/gujarat';
import RssGujaratPage, { getStaticProps as getRssProps } from '../../pages/gujarat';
import { selectRegionalInitialStories } from '../../lib/regionalInitialStories';
let mockLocale = 'en';
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/regional/gujarat', locale: mockLocale, query: {}, push: jest.fn() }) }));
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ normalizeLang: (locale: string) => locale || 'en', useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async () => ({}) }));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({ __esModule: true, default: ({ children }: any) => <main>{children}</main> }));
jest.mock('../../components/regional/RegionalHomeStorySections', () => ({ __esModule: true, default: ({ stories, loading }: any) => <section>{loading ? 'Loading stories' : stories.map((story: any) => <h2 key={story._id}>{story.title}</h2>)}</section> }));

function story(locale: string, title = 'Initial regional story') {
  return { _id: title, title, language: locale, category: 'regional', status: 'published', publishedAt: '2026-01-01T10:00:00Z', slug: 'regional-story' };
}
describe('Gujarat initial loading', () => {
  test('initial data respects the same suppressed IDs as the regional proxy', () => {
    expect(selectRegionalInitialStories([{ ...story('en'), _id: '69c0c4707c7cb68a34add518' }], 'en')).toEqual([]);
  });

  test('legacy RSS route seeds its existing source and does not repeat the hydration fetch', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [{ title: 'Gujarati RSS story', link: 'https://example.test/story' }] }) })) as any;
    const result = await getRssProps({ locale: 'gu', revalidateReason: 'build' } as any) as any;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    (global.fetch as jest.Mock).mockClear();
    render(<RssGujaratPage {...result.props} />);
    expect(screen.getByText('Gujarati RSS story')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  afterEach(() => { cleanup(); jest.useRealTimers(); });
  test.each(['en', 'hi', 'gu'])('%s initial stories render immediately without hydration requests', async (locale) => {
    mockLocale = locale;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [story(locale), story(locale === 'en' ? 'hi' : 'en', 'Wrong locale')] }) })) as any;
    const result = await getStaticProps({ locale, revalidateReason: 'build' } as any) as any;
    expect(result.revalidate).toBe(60);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    (global.fetch as jest.Mock).mockClear();
    render(<GujaratPage {...result.props} />);
    expect(screen.getByText('Initial regional story')).toBeTruthy();
    expect(screen.queryByText('Wrong locale')).toBeNull();
    expect(screen.queryByText('Loading stories')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test.each(['headers', 'body'])('stalled initial %s returns empty build props at four seconds', async (stage) => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => stage === 'headers' ? new Promise(() => {}) : Promise.resolve({ ok: true, json: () => new Promise(() => {}) })) as any;
    let completed = false;
    const pending = Promise.resolve(getStaticProps({ locale: 'gu', revalidateReason: 'build' } as any)).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    expect((await pending as any).props.initialStories).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('background regeneration failure retains the previous ISR page', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Offline'));
    await expect(getStaticProps({ locale: 'en', revalidateReason: 'stale' } as any)).rejects.toThrow('Offline');
  });
  test('a timed-out refresh keeps seeded stories visible', async () => {
    mockLocale = 'en';
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    render(<GujaratPage initialStories={[story('en')]} initialLocale="en" />);
    await act(async () => { await jest.advanceTimersByTimeAsync(64_000); });
    expect(screen.getByText('Initial regional story')).toBeTruthy();
    expect(screen.queryByText('Loading stories')).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('empty client loading ends after timeout and a later refresh recovers', async () => {
    mockLocale = 'en';
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [story('en', 'Recovered story')] }) });
    render(<GujaratPage />);
    expect(screen.getByText('Loading stories')).toBeTruthy();
    await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
    expect(screen.queryByText('Loading stories')).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(56_000); });
    expect(screen.getByText('Recovered story')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});