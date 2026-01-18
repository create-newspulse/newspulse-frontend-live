import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useYouthPulse } from '../../features/youthPulse/useYouthPulse';
import type { YouthStory } from '../../features/youthPulse/types';
import { useI18n } from '../../src/i18n/LanguageProvider';

export default function YouthCategoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { category } = router.query as { category?: string };
  const { topics, getByCategory } = useYouthPulse();
  const [stories, setStories] = useState<YouthStory[]>([]);
  const meta = topics.find((c) => c.slug === category);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!category) return;
      const list = await getByCategory(category);
      if (mounted) setStories(list);
    })();
    return () => { mounted = false; };
  }, [category, getByCategory]);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{meta ? `${meta.title} • ${t('youthPulse.title')}` : t('youthPulse.title')}</title>
        <meta name="robots" content="index,follow" />
      </Head>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">
              {meta ? `${meta.emoji} ${meta.title}` : t('youthPulse.title')}
            </h1>
            {meta && (
              <p className="mt-2 text-gray-600 dark:text-gray-300">{meta.description}</p>
            )}
          </div>
          <Link href="/youth-pulse" className="text-sm text-indigo-600">← {t('common.back')}</Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {stories.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-300">{t('youthPulse.noPostsYet')}</p>
          ) : (
            stories.map((s) => (
              <article key={s.id} className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full aspect-[16/9] object-cover bg-gray-100 dark:bg-gray-800"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src.includes('/images/placeholder-16x9.svg')) return;
                    target.src = '/images/placeholder-16x9.svg';
                  }}
                />
                <div className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{s.category}</div>
                  <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{s.summary}</p>
                  <div className="mt-3 text-xs text-gray-500">{s.date}</div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
