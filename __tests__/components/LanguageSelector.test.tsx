import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import LanguageSelector from '../../components/LanguageSelector';

const setLanguageMock = jest.fn();

jest.mock('../../utils/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', setLanguage: setLanguageMock }),
}));

jest.mock('../../src/i18n/LanguageProvider', () => ({
  useI18n: () => ({ t: (key: string) => (key === 'common.language' ? 'Language' : key) }),
}));

jest.mock('../../src/context/PublicSettingsContext', () => ({
  usePublicSettings: () => ({ settings: null }),
}));

describe('LanguageSelector global control', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  test('keeps the global language selector visible and preserves current route on change', () => {
    render(<LanguageSelector />);

    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByRole('button', { name: /English/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ગુજરાતી/ }));

    expect(setLanguageMock).toHaveBeenCalledWith('gu');
    expect(setLanguageMock).not.toHaveBeenCalledWith('gu', { path: '/' });
  });
});