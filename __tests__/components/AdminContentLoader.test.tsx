import React from 'react';
import { act, render, screen } from '@testing-library/react';

import AdminContentLoader from '../../components/AdminContentLoader';
import { fetchCategoryNews } from '../../lib/fetchCategoryNews';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { getMessagesForLang, LanguageProvider } from '../../src/i18n/LanguageProvider';

jest.mock('../../lib/fetchCategoryNews', () => ({ fetchCategoryNews: jest.fn() }));
jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn() }));
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, role, className }: React.HTMLAttributes<HTMLDivElement>) => <div role={role} className={className}>{children}</div>,
  },
}));

describe.each(['en', 'hi', 'gu'] as const)('public AdminContentLoader (%s)', (lang) => {
  const messages = getMessagesForLang(lang);
  const story = { _id: 'reported-loader', title: 'Reported public story', language: lang, status: 'published' };
  const response = { items: [story], meta: {}, endpoint: '/api/public/news' };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    jest.mocked(fetchPublicNews).mockReset().mockResolvedValue(response);
    jest.mocked(fetchCategoryNews).mockReset().mockResolvedValue(response);
  });

  afterEach(() => { jest.useRealTimers(); });

  describe.each(['public', 'category'] as const)('%s read', (source) => {
    const category = source === 'category' ? 'national' : undefined;
    const fetcher = source === 'category' ? jest.mocked(fetchCategoryNews) : jest.mocked(fetchPublicNews);

    function renderLoader() {
      return render(
        <LanguageProvider initialLang={lang}>
          <AdminContentLoader category={category}>
            {({ news, loading, isConnected, lastUpdated }) => (
              <section
                data-testid="loader-content"
                data-loading={String(loading)}
                data-connected={String(isConnected)}
                data-updated={lastUpdated?.toISOString() || ''}
              >
                {news.map(item => <h2 key={item._id}>{item.title}</h2>)}
              </section>
            )}
          </AdminContentLoader>
        </LanguageProvider>
      );
    }

    test.each(['returned', 'rejected'] as const)('%s cold failure never displays Live or Updated', async (failure) => {
      if (failure === 'rejected') fetcher.mockRejectedValue(new Error('Read unavailable'));
      else fetcher.mockResolvedValue({ ...response, error: 'API 503' });
      renderLoader();
      await act(async () => {});
      expect(screen.getByRole('alert').textContent).toBe(messages.categoryPage.unableToLoadTitle);
      expect(screen.queryByText(/\b(Live|Updated)\b/)).toBeNull();
      expect(screen.queryByText(messages.errors.showingPreviousStories)).toBeNull();
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.getByTestId('loader-content').getAttribute('data-connected')).toBe('false');
      expect(screen.getByTestId('loader-content').getAttribute('data-updated')).toBe('');
      expect(screen.getByTestId('loader-content').getAttribute('data-loading')).toBe('false');
    });

    test('loading remains neutral and a successful real read preserves Live/Updated behavior', async () => {
      let resolveRead!: (result: typeof response) => void;
      fetcher.mockReturnValue(new Promise(resolve => { resolveRead = resolve; }));
      renderLoader();
      expect(screen.getByTestId('loader-content').getAttribute('data-loading')).toBe('true');
      expect(screen.queryByText(/\b(Live|Updated)\b/)).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      await act(async () => { resolveRead(response); });
      expect(screen.getByRole('heading').textContent).toBe(story.title);
      expect(screen.getByText(/Live.*Updated/)).toBeTruthy();
      expect(screen.getByTestId('loader-content').getAttribute('data-loading')).toBe('false');
      expect(screen.getByTestId('loader-content').getAttribute('data-updated')).toBe('2026-10-01T10:00:00.000Z');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ language: lang, limit: 10, ...(category ? { categoryKey: category } : {}) }));
    });

    test('successful empty remains connected without inventing stories', async () => {
      fetcher.mockResolvedValue({ ...response, items: [] });
      renderLoader();
      await act(async () => {});
      expect(screen.getByTestId('loader-content').getAttribute('data-connected')).toBe('true');
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText(/Live.*Updated/)).toBeTruthy();
    });

    test.each(['returned', 'rejected'] as const)('%s background failure labels previous stories and clears successful-read metadata', async (failure) => {
      renderLoader();
      await act(async () => {});
      expect(screen.getByText(/Live.*Updated/)).toBeTruthy();
      if (failure === 'rejected') fetcher.mockRejectedValue(new Error('Read unavailable'));
      else fetcher.mockResolvedValue({ ...response, items: [], error: 'API 503' });
      await act(async () => { await jest.advanceTimersByTimeAsync(300_000); });
      expect(screen.getByRole('heading').textContent).toBe(story.title);
      expect(screen.getByRole('alert').textContent).toContain(messages.categoryPage.unableToLoadTitle);
      expect(screen.getByRole('alert').textContent).toContain(messages.errors.showingPreviousStories);
      expect(screen.queryByText(/\b(Live|Updated)\b/)).toBeNull();
      expect(screen.getByTestId('loader-content').getAttribute('data-connected')).toBe('false');
      expect(screen.getByTestId('loader-content').getAttribute('data-updated')).toBe('');

      fetcher.mockResolvedValue(response);
      await act(async () => { await jest.advanceTimersByTimeAsync(300_000); });
      expect(screen.getByRole('heading').textContent).toBe(story.title);
      expect(screen.getByText(/Live.*Updated/)).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
