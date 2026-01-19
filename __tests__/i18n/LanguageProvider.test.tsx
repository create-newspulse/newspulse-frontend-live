import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider, useI18n } from '../../src/i18n/LanguageProvider';

function Probe() {
  const { lang, t } = useI18n();
  return (
    <div>
      <div data-testid="lang">{lang}</div>
      <div data-testid="languageLabel">{t('common.language')}</div>
      <div data-testid="betaLabel">{t('common.beta')}</div>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  it('defaults to English (en) when storage is empty', async () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it('initializes from initialLang=hi', async () => {
    render(
      <LanguageProvider initialLang="hi">
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('hi');
      expect(document.documentElement.lang).toBe('hi');
    });
  });

  it('returns key for unknown translation keys', async () => {
    render(
      <LanguageProvider initialLang="hi">
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('hi');
    });

    expect(screen.getByTestId('languageLabel').textContent).toBe('भाषा');
    expect(screen.getByTestId('betaLabel').textContent).toBe('बीटा');
    expect(screen.getByTestId('betaLabel').textContent).not.toBe('common.beta');
  });
});
