import Head from 'next/head';
import { motion } from 'framer-motion';
import DroneTVSection from '../components/inspiration/DroneTVSection';
import DailyWondersSection from '../components/inspiration/DailyWondersSection';
import type { InspirationItem } from '../components/inspiration/InspirationCard';
import data from '../data/inspiration.json';
import type { GetStaticProps } from 'next';

export default function InspirationHubPage() {
  const sections = (data.sections as InspirationItem[]) || [];
  const drone = sections.find((s) => s.id === 'drone-tv');
  const wonders = sections.find((s) => s.id === 'daily-wonders');

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>🌄 Inspiration Hub • NewsPulse</title>
        <meta
          name="description"
          content="Explore scenic relaxation videos, uplifting stories, and visual quotes to refresh your mind."
        />
        <meta name="robots" content="index,follow" />
      </Head>

      {/* Gradient header */}
      <div className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-5xl font-extrabold"
          >
            🌄 Inspiration Hub
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-2 text-white/90"
          >
            Explore scenic relaxation videos, uplifting stories, and visual quotes to refresh your mind.
          </motion.p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 grid gap-8">
        {drone && <DroneTVSection item={drone} />}
        {wonders && <DailyWondersSection item={wonders} />}
      </main>
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
