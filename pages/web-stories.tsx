import Head from 'next/head';
import dynamic from 'next/dynamic';
import type { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';

const WebStories = dynamic(() => import('../components/WebStories'), { ssr: false });

export default function WebStoriesPage() {
  const t = useTranslations('categories');
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Web Stories - News Pulse</title>
        <meta name="description" content="Swipeable visual stories from News Pulse." />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">📚 {t('webStories')}</h1>
        <WebStories />
      </div>
    </div>
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
