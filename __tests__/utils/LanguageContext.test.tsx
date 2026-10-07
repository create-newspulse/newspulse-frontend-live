import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useLanguage } from '../../utils/LanguageContext';

const replaceMock = jest.fn(() => Promise.resolve(true));
const setLangMock = jest.fn();

let mockRouter: any;

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../../src/i18n/LanguageProvider', () => ({
  getSelectedLanguage: () => 'en',
  normalizeLang: (value: unknown) => {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'hi' || raw === 'gu') return raw;
    return 'en';
  },
  useI18n: () => ({ lang: 'en', setLang: setLangMock }),
}));

function Harness() {
  const { setLanguage } = useLanguage();
  return (
    <div>
      <button type="button" onClick={() => setLanguage('en')}>English</button>
      <button type="button" onClick={() => setLanguage('hi')}>Hindi</button>
      <button type="button" onClick={() => setLanguage('gu')}>Gujarati</button>
    </div>
  );
}

describe('LanguageContext route switching', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    setLangMock.mockClear();
    mockRouter = {
      isReady: true,
      asPath: '/news/english-story',
      locale: 'en',
      defaultLocale: 'en',
      replace: replaceMock,
    };
  });

  afterEach(() => cleanup());

  test('opens Hindi and Gujarati versions on the same article route', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('Hindi'));
    expect(replaceMock).toHaveBeenLastCalledWith('/hi/news/english-story', '/hi/news/english-story', {
      locale: 'hi',
      shallow: false,
      scroll: false,
    });

    fireEvent.click(screen.getByText('Gujarati'));
    expect(replaceMock).toHaveBeenLastCalledWith('/gu/news/english-story', '/gu/news/english-story', {
      locale: 'gu',
      shallow: false,
      scroll: false,
    });
  });

  test('opens English version from a localized article route without changing story path', () => {
    mockRouter.asPath = '/gu/news/gujarati-story';
    mockRouter.locale = 'gu';

    render(<Harness />);

    fireEvent.click(screen.getByText('English'));
    expect(replaceMock).toHaveBeenLastCalledWith('/news/gujarati-story', '/news/gujarati-story', {
      locale: 'en',
      shallow: false,
      scroll: false,
    });
  });

  test.each([
    ['en', 'hi', 'Hindi'], ['en', 'gu', 'Gujarati'], ['hi', 'en', 'English'],
    ['hi', 'gu', 'Gujarati'], ['gu', 'en', 'English'], ['gu', 'hi', 'Hindi'],
  ] as const)('preserves Faith stable topic and search when switching %s to %s', (from, to, button) => {
    const query = '?topic=living-heritage&q=heritage';
    mockRouter.asPath = `${from === 'en' ? '' : `/${from}`}/faith-culture${query}`;
    mockRouter.locale = from;
    render(<Harness />);
    fireEvent.click(screen.getByText(button));
    const target = `${to === 'en' ? '' : `/${to}`}/faith-culture${query}`;
    expect(replaceMock).toHaveBeenCalledWith(target, target, { locale: to, shallow: false, scroll: false });
  });
});