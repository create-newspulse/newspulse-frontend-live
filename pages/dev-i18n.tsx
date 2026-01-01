import React from 'react';
import type { GetServerSideProps } from 'next';

import { LanguageDropdown, useLanguage } from '../src/i18n/language';

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return { notFound: true };
  }
  return { props: {} };
};

export default function DevI18nPage() {
  const { t, language } = useLanguage();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('brand.name')} – i18n probe</h1>
          <LanguageDropdown compact />
        </div>

        <div className="mt-6 rounded-xl border border-black/10 p-4">
          <div className="text-sm text-black/60">Active lang: {language}</div>
          <div className="mt-3 grid gap-2">
            <div>{t('common.home')}</div>
            <div>{t('common.search')}</div>
            <div>{t('common.login')}</div>
            <div>{t('common.viewAll')}</div>
            <div>{t('searchPage.placeholder')}</div>
            <div>{t('searchPage.hintEmpty')}</div>
            <div>{t('categories.breaking')}</div>
            <div>{t('categories.national')}</div>
            <div>{t('categories.international')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
