import React from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { useI18n } from '../src/i18n/LanguageProvider';

export default function MaintenancePage() {
  const { t } = useI18n();
  return (
    <>
      <Head>
        <title>{`${t('maintenancePage.headTitle')} | ${t('brand.name')}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4">
        <div className="max-w-md text-center">
          <div className="mb-6">
            <span className="text-6xl" role="img" aria-label="maintenance">
              🛠️
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-4">{t('maintenancePage.title')}</h1>
          <p className="text-slate-300 mb-6">
            {t('maintenancePage.description')}
          </p>
          <p className="text-sm text-slate-400">
            {t('maintenancePage.hint')}
          </p>
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
