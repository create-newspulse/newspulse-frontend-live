import Head from 'next/head';
import { motion } from 'framer-motion';
import InspirationHero from '../components/inspiration/InspirationHero';
import DroneTVSection from '../components/inspiration/DroneTVSection';
import DailyWondersSection from '../components/inspiration/DailyWondersSection';
import PositiveStoriesSection from '../components/inspiration/PositiveStoriesSection';
import { dailyWonderQuotes, positiveStoryItems, scenicMediaItems } from '../data/inspirationHubContent';
import type { GetStaticProps } from 'next';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { resolveInspirationHubDroneTvEmbedUrl } from '../src/lib/inspirationHubSettings';

export default function InspirationHubPage() {
  const { settings } = usePublicSettings();
  const droneVideoEmbedUrl = resolveInspirationHubDroneTvEmbedUrl(settings, 'categoryPage');

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbfb_0%,#f8fbff_42%,#ffffff_100%)] text-black dark:bg-dark-primary dark:text-dark-text">
      <Head>
        <title>Inspiration Hub • NewsPulse</title>
        <meta
          name="description"
          content="Explore scenic relaxation videos, uplifting stories, and visual quotes to refresh your mind."
        />
        <meta name="robots" content="index,follow" />
      </Head>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_52%_100%,rgba(250,204,21,0.08),transparent_36%)]" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <InspirationHero
              title="Inspiration Hub"
              subtitle="Explore scenic relaxation videos, uplifting stories, and visual quotes to refresh your mind."
            />
          </motion.div>

          <div className="mt-8 grid gap-8 lg:gap-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
            >
              <DroneTVSection items={scenicMediaItems} videoEmbedUrl={droneVideoEmbedUrl} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <DailyWondersSection quotes={dailyWonderQuotes} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <PositiveStoriesSection items={positiveStoryItems} />
            </motion.div>
          </div>
        </div>
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
