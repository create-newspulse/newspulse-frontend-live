import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { getYouthByCategory, getYouthTopics } from '../../features/youthPulse/api';
import type { YouthCategory, YouthStory } from '../../features/youthPulse/types';
import { useLanguage } from '../../utils/LanguageContext';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { StoryImage } from '../../src/components/story/StoryImage';

type Props = { initialStories: YouthStory[]; initialTopics: YouthCategory[]; initialLocale: string; initialCategory: string; messages: any };
const EMPTY_STORIES: YouthStory[] = [];

export default function YouthCategoryPage({ initialStories, initialTopics, initialLocale, initialCategory }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { language } = useLanguage();
  const category = String(router.query.category || initialCategory || '');
  const seed = useMemo(() => language === initialLocale && category === initialCategory ? initialStories : EMPTY_STORIES, [language, initialLocale, category, initialCategory, initialStories]);
  const [stories, setStories] = useState<YouthStory[]>(seed);
  const meta = initialTopics.find((item) => item.slug === category);

  useEffect(() => {
    const controller = new AbortController();
    setStories(seed);
    const refresh = async () => {
      if (!category) return;
      try {
        const list = await getYouthByCategory(category, language, { signal: controller.signal });
        if (!controller.signal.aborted) setStories(list);
      } catch {}
    };
    if (!seed.length) void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [category, language, seed]);

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
            stories.filter((story) => story.language === language).map((s) => (
              <article
                key={s.id}
                className="group relative rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
              >
                <StoryImage src={s.image} alt={s.title} variant="top" />
                <div className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{s.categoryLabel || s.category}</div>
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

export const getServerSideProps: GetServerSideProps<Props> = async ({ locale, params }) => {
  const initialLocale = locale === 'hi' || locale === 'gu' ? locale : 'en';
  const initialCategory = String(params?.category || '');
  const { getMessages } = await import('../../lib/getMessages');
  const initialStories = await getYouthByCategory(initialCategory, initialLocale).catch(() => []);
  return { props: {
    initialStories, initialLocale, initialCategory,
    initialTopics: JSON.parse(JSON.stringify(await getYouthTopics())),
    messages: await getMessages(initialLocale),
  } };
};
