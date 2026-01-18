import React from 'react';
import type { GetStaticProps } from 'next';
import { useI18n } from '../src/i18n/LanguageProvider';

export default function Offline() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-slate-100">
      <h1 className="text-2xl font-semibold">{t('offlinePage.title')}</h1>
      <p className="mt-2 opacity-80">{t('offlinePage.subtitle')}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-4 py-2 rounded-md bg-white text-slate-900 font-semibold shadow hover:shadow-lg transition"
      >{t('offlinePage.retry')}</button>
    </main>
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
