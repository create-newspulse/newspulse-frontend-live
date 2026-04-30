import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';

import PublicViralVideoCard from '../../components/viral-videos/PublicViralVideoCard';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';
import { normalizePublicViralVideosPayload, type PublicViralVideo } from '../../lib/publicViralVideos';
import { useI18n } from '../../src/i18n/LanguageProvider';

type Props = {
  messages: any;
  locale: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const featureToggles = await fetchServerPublicFounderToggles();

  if (featureToggles.viralVideosFrontendEnabled === false) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  return {
    props: {
      messages,
      locale,
    },
  };
};

export default function ViralVideosPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = React.useState<PublicViralVideo[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const title = t('categories.viralVideos') || 'Viral Videos';

  React.useEffect(() => {
    const controller = new AbortController();
    const lang = String(router.locale || 'en').toLowerCase();
    setLoaded(false);
    setError(null);

    (async () => {
      const params = new URLSearchParams();
      params.set('language', lang);
      params.set('t', String(Date.now()));

      const response = await fetch(`/api/public/viral-videos?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (controller.signal.aborted) return;

      const normalized = normalizePublicViralVideosPayload(payload);
      if (!response.ok) {
        setItems([]);
        setError(t('errors.fetchFailed'));
        setLoaded(true);
        return;
      }

      setItems(normalized.settings.frontendEnabled === false ? [] : normalized.items);
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setItems([]);
      setError(t('errors.fetchFailed'));
      setLoaded(true);
    });

    return () => controller.abort();
  }, [router.locale, t]);

  return (
    <>
      <Head>
        <title>{`${title} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">Latest published clips and viral moments from News Pulse.</p>
          </header>

          {error ? (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          ) : loaded && items.length === 0 ? (
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
              <div className="text-lg font-semibold text-slate-900">No viral videos yet.</div>
            </div>
          ) : (
            <section className="mt-8">
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((video) => (
                  <li key={video.id}>
                    <PublicViralVideoCard video={video} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
