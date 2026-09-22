import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { HomeSpotlightCarousel } from '../../components/home/HomeSharedFeatureModules';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), asPath: '/', pathname: '/' }),
}));

jest.mock('../../src/i18n/LanguageProvider', () => ({
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