import React from 'react';
import { act, render, screen } from '@testing-library/react';

import HomeRightRail, { HomeRightRailLatestNews, HomeRightRailYouthDesk } from '../../components/home/HomeRightRail';
import { useYouthPulse, type UseYouthPulseReturn } from '../../features/youthPulse/useYouthPulse';
import { getMessagesForLang, LanguageProvider } from '../../src/i18n/LanguageProvider';

jest.mock('../../features/youthPulse/useYouthPulse', () => ({ useYouthPulse: jest.fn() }));
jest.mock('../../src/components/ads/AdSlot', () => ({ __esModule: true, default: () => null }));

function setYouthState(overrides: Partial<UseYouthPulseReturn> = {}) {
  jest.mocked(useYouthPulse).mockReturnValue({
    topics: [],
    trending: [],
    loading: false,
    error: null,
    refresh: jest.fn(async () => {}),
    getByCategory: jest.fn(async () => []),
    ...overrides,
  });
}

describe.each(['en', 'hi', 'gu'] as const)('truthful right rail (%s)', (lang) => {
  const messages = getMessagesForLang(lang);
  const prefix = lang === 'en' ? '' : `/${lang}`;
  const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider initialLang={lang}>{children}</LanguageProvider>;
  const youthStories = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `reported-youth-${index}`,
    title: `Reported youth story ${index}`,
    summary: 'Reported summary',
    category: 'education',
    image: '',
    date: '2026-10-01T10:00:00Z',
    language: lang,
  }));
  const latestStory = { id: 'reported-latest', slug: 'reported-latest', title: 'Reported latest story', category: 'national' };

  beforeEach(() => {
    setYouthState();
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
  });

  afterEach(() => { jest.restoreAllMocks(); });

  test.each([1, 2, 8, 9, 12])('Youth Desk renders only the first nine real returned stories from %i items', (count) => {
    const stories = youthStories(count);
    setYouthState({ trending: stories });
    const { container } = render(<HomeRightRailYouthDesk lang={lang} />, { wrapper });
    const links = Array.from(container.querySelectorAll('a.group'));
    expect(links.map(link => link.textContent)).toEqual(stories.slice(0, 9).map(story => story.title));
    expect(links.every(link => link.getAttribute('href') === `${prefix}/youth-pulse`)).toBe(true);
  });

  test('empty and failed Youth reads never create filler stories', () => {
    const { container, rerender } = render(<HomeRightRailYouthDesk lang={lang} />, { wrapper });
    expect(container.childElementCount).toBe(0);
    setYouthState({ error: 'API 503' });
    rerender(<HomeRightRailYouthDesk lang={lang} />);
    expect(container.childElementCount).toBe(0);
  });

  test('Youth loading retains the neutral skeleton without story links', () => {
    setYouthState({ loading: true });
    const { container } = render(<HomeRightRailYouthDesk lang={lang} />, { wrapper });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelectorAll('a.group')).toHaveLength(0);
  });

  test('retained real Youth stories are not padded after failure', () => {
    const stories = youthStories(2);
    setYouthState({ trending: stories, error: 'API 503' });
    const { container } = render(<HomeRightRailYouthDesk lang={lang} />, { wrapper });
    expect(Array.from(container.querySelectorAll('a.group')).map(link => link.textContent)).toEqual(stories.map(story => story.title));
  });

  test('Latest distinguishes loading, successful empty, and failure', () => {
    const { container, rerender } = render(<HomeRightRailLatestNews items={null} lang={lang} />, { wrapper });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<HomeRightRailLatestNews items={[]} lang={lang} />);
    expect(screen.getByRole('status').textContent).toBe(messages.categoryPage.noStoriesYet);
    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<HomeRightRailLatestNews items={[]} hasReadError lang={lang} />);
    expect(screen.getByRole('alert').textContent).toBe(messages.categoryPage.unableToLoadTitle);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('a[href*="/news/"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\b(Live|Updated)\b/);
  });

  test('a failed refresh labels retained real Latest stories without changing their links', () => {
    const { rerender } = render(<HomeRightRailLatestNews items={[latestStory]} lang={lang} />, { wrapper });
    expect(screen.getByRole('link', { name: /Reported latest story/ }).getAttribute('href')).toBe(`${prefix}/news/reported-latest`);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<HomeRightRailLatestNews items={[latestStory]} hasReadError lang={lang} />);
    expect(screen.getByRole('alert').textContent).toContain(messages.errors.showingPreviousStories);
    expect(screen.getByRole('link', { name: /Reported latest story/ }).getAttribute('href')).toBe(`${prefix}/news/reported-latest`);
    expect(screen.queryByText(/\b(Live|Updated)\b/)).toBeNull();
  });

  test('the rail wrapper forwards failed-read status to Latest', async () => {
    render(<HomeRightRail latestItems={[]} latestReadError lang={lang} />, { wrapper });
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toBe(messages.categoryPage.unableToLoadTitle);
    expect(screen.queryByText(messages.categoryPage.noStoriesYet)).toBeNull();
  });
});
