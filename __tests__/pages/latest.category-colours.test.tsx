import React from 'react';
import { act, render, screen } from '@testing-library/react';

import LatestPage from '../../pages/latest';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import * as storyTitleHook from '../../lib/storyTitleHook';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';

let mockLocale: 'en' | 'hi' | 'gu' = 'en';

jest.mock('next/router', () => ({
  useRouter: () => ({ locale: mockLocale, asPath: mockLocale === 'en' ? '/latest' : `/${mockLocale}/latest` }),
}));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
}));
jest.mock('../../lib/publicNewsApi', () => ({
  fetchPublicNews: jest.fn(),
}));

describe('/latest category identity and independent palettes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each([
    ['regional', 'regional', 'text-emerald-800', 'bg-emerald-500/90', 'rgb(101, 163, 13)'],
    ['national', 'national', 'text-amber-900', 'bg-amber-500/90', 'rgb(37, 99, 235)'],
    ['international', 'international', 'text-blue-800', 'bg-blue-500/90', 'rgb(124, 58, 237)'],
    ['glamour', 'glamour', 'text-rose-900', 'bg-rose-500/90', 'rgb(192, 38, 211)'],
    ['tech', 'scienceTechnology', 'text-violet-800', 'bg-violet-500/90', 'rgb(8, 145, 178)'],
    ['tech-gadgets', 'techGadgets', 'text-violet-800', 'bg-violet-500/90', 'rgb(37, 99, 235)'],
    ['pulse-dialogue', 'pulseDialogue', 'text-slate-800', 'bg-slate-400/80', 'rgb(37, 99, 235)'],
    ['faith-culture', 'faithCulture', 'text-slate-800', 'bg-slate-400/80', 'rgb(37, 99, 235)'],
    ['editorial', 'editorial', 'text-slate-800', 'bg-slate-400/80', 'rgb(20, 184, 166)'],
    ['unknown-desk', 'regional', 'text-slate-800', 'bg-slate-400/80', 'rgb(37, 99, 235)'],
  ])('%s', (category, labelKey, badgeClass, accentClass, color) => {
    test.each(['en', 'hi', 'gu'] as const)('preserves the %s label without using it for styling', async (locale) => {
      mockLocale = locale;
      const label = getMessagesForLang(locale).categories[labelKey] as string;
      const title = `${label}: remaining headline text`;
      const article = {
        _id: 'latest-colour-story', slug: 'latest-colour-story',
        category, title, content: '<p>Body</p>', language: locale,
        status: 'published', publishedAt: '2026-10-01T10:00:00.000Z',
        translations: { [locale]: { title, categoryLabel: label } },
      };
      jest.mocked(fetchPublicNews).mockResolvedValue({ items: [article], meta: {}, endpoint: '/api/public/news' });
      const colorLookup = jest.spyOn(storyTitleHook, 'getStoryTitleHookColor');

      await act(async () => {
        render(<LanguageProvider initialLang={locale}><LatestPage /></LanguageProvider>);
      });

      const badge = screen.getByText(label);
      expect(badge.classList.contains(badgeClass)).toBe(true);
      const link = badge.closest('a');
      expect(link?.querySelector('.absolute')?.classList.contains(accentClass)).toBe(true);
      expect(screen.getByText(`${label}:`).style.color).toBe(color);
      expect(screen.getByText('remaining headline text').style.color).toBe('');
      expect(colorLookup).toHaveBeenCalledWith(category === 'tech' ? 'science-technology' : category);
      expect(colorLookup).not.toHaveBeenCalledWith(label);
      expect(link?.getAttribute('href')).toBe(`${locale === 'en' ? '' : `/${locale}`}/news/latest-colour-story`);
    });
  });
});
