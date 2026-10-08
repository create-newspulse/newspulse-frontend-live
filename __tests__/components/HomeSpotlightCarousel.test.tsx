import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { HomeSpotlightCarousel } from '../../components/home/HomeSharedFeatureModules';
import * as i18n from '../../src/i18n/LanguageProvider';
import * as storyTitleHook from '../../lib/storyTitleHook';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), asPath: '/', pathname: '/' }),
}));

jest.mock('../../src/i18n/LanguageProvider', () => ({
  __esModule: true,
  ...jest.requireActual('../../src/i18n/LanguageProvider'),
  useI18n: () => ({
    t: (key: string) => ({
      'common.viewAll': 'View all',
      'common.read': 'Read',
      'common.minutesShort': 'min',
      'categories.national': 'National',
    } as Record<string, string>)[key] || key,
  }),
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} data-testid="spotlight-image" />,
}));

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    article: ({ children, ...props }: any) => <article {...props}>{children}</article>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

const theme = {
  mode: 'light',
  surface: '#fff',
  surface2: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  sub: '#475569',
  accent: '#2563eb',
  accent2: '#7c3aed',
};

function story(index: number) {
  return {
    _id: `story-${index}`,
    id: `story-${index}`,
    slug: `story-${index}`,
    title: `Spotlight story ${index}`,
    desc: `Summary for spotlight story ${index} with enough words for reading time.`,
    category: 'national',
    imageSrc: `/images/story-${index}.jpg`,
    time: `Sep ${index}, 2026`,
  };
}

describe('HomeSpotlightCarousel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe.each([
    ['regional', 'rgb(101, 163, 13)'],
    ['national', 'rgb(37, 99, 235)'],
    ['international', 'rgb(124, 58, 237)'],
    ['glamour', 'rgb(192, 38, 211)'],
    ['pulse-dialogue', 'rgb(37, 99, 235)'],
  ])('%s colour identity', (category, color) => {
    test.each(['en', 'hi', 'gu'] as const)('keeps the %s label separate from the colour lookup', (locale) => {
      const actual = jest.requireActual<typeof import('../../src/i18n/LanguageProvider')>('../../src/i18n/LanguageProvider');
      jest.spyOn(i18n, 'useI18n').mockImplementation(actual.useI18n);
      const colorLookup = jest.spyOn(storyTitleHook, 'getStoryTitleHookColor');
      const label = actual.getMessagesForLang(locale).categories[category === 'pulse-dialogue' ? 'pulseDialogue' : category] as string;
      const item = { ...story(1), category, title: `${label}: remaining headline text` };

      render(
        <i18n.LanguageProvider initialLang={locale}>
          <HomeSpotlightCarousel theme={theme} title="Spotlight" href="/latest" items={[item]} lang={locale} />
        </i18n.LanguageProvider>
      );

      expect(screen.getByText(category === 'pulse-dialogue' ? category : label)).toBeTruthy();
      expect(screen.getByText(`${label}:`).style.color).toBe(color);
      expect(colorLookup).toHaveBeenCalledWith(category);
      expect(colorLookup).not.toHaveBeenCalledWith(label);
    });
  });

  test('keeps slideshow controls, counter, dots, links, and 8-item cap working', () => {
    render(
      <HomeSpotlightCarousel
        theme={theme}
        title="News Pulse Spotlight"
        href="/latest"
        items={Array.from({ length: 10 }, (_, index) => story(index + 1))}
        lang="en"
      />
    );

    expect(screen.getByText('News Pulse Spotlight')).toBeTruthy();
    expect(screen.getByText('Spotlight story 1')).toBeTruthy();
    expect(screen.getByText('1 / 8')).toBeTruthy();
    expect(screen.getAllByLabelText(/Go to spotlight story/i)).toHaveLength(8);
    expect(screen.queryByLabelText('Go to spotlight story 9')).toBeNull();

    expect(screen.getByRole('link', { name: /View all/i }).getAttribute('href')).toBe('/latest');
    expect(screen.getByRole('link', { name: /Read/i }).getAttribute('href')).toContain('story-1');

    fireEvent.click(screen.getAllByLabelText('Next spotlight story')[0]);
    expect(screen.getByText('Spotlight story 2')).toBeTruthy();
    expect(screen.getByText('2 / 8')).toBeTruthy();

    fireEvent.click(screen.getAllByLabelText('Previous spotlight story')[0]);
    expect(screen.getByText('Spotlight story 1')).toBeTruthy();
    expect(screen.getByText('1 / 8')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Go to spotlight story 4'));
    expect(screen.getByText('Spotlight story 4')).toBeTruthy();
    expect(screen.getByText('4 / 8')).toBeTruthy();
  });

  test('auto-rotates on the existing 5 second interval', () => {
    render(
      <HomeSpotlightCarousel
        theme={theme}
        title="News Pulse Spotlight"
        href="/latest"
        items={[story(1), story(2), story(3)]}
        lang="en"
      />
    );

    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Spotlight story 2')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});