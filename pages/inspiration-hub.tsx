import Head from 'next/head';
import { motion } from 'framer-motion';
import InspirationHero from '../components/inspiration/InspirationHero';
import DroneTVSection from '../components/inspiration/DroneTVSection';
import DailyWondersSection from '../components/inspiration/DailyWondersSection';
import PositiveStoriesSection from '../components/inspiration/PositiveStoriesSection';
import { getInspirationHubContent } from '../data/inspirationHubContent';
import type { GetStaticProps } from 'next';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { resolveInspirationHubDroneTvSettings, resolveInspirationHubSectionText } from '../src/lib/inspirationHubSettings';
import { useI18n } from '../src/i18n/LanguageProvider';

export default function InspirationHubPage() {
  const { lang, t } = useI18n();
  const { settings } = usePublicSettings();
  const sectionSettings = resolveInspirationHubSectionText(settings);
  const droneTvSettings = resolveInspirationHubDroneTvSettings(settings, 'categoryPage');
  const content = getInspirationHubContent(lang);
  const sectionTitle = sectionSettings?.title || t('categories.inspirationHub');
  const sectionSubtitle = sectionSettings?.subtitle || t('inspirationHub.page.subtitle');
  const droneVoiceTitle = droneTvSettings?.title || t('inspirationHub.page.drone.title');
  const voiceText = [
    t('inspirationHub.voice.intro'),
    sectionTitle,
    sectionSubtitle,
    droneVoiceTitle,
    ...content.scenicMediaItems.map((item) => `${item.title}. ${item.description}`),
    t('inspirationHub.page.dailyWonders.title'),
    ...content.dailyWonderQuotes.map((item) => `${item.quote}. ${item.support}`),
    t('inspirationHub.page.positiveStories.title'),
    ...content.positiveStoryItems.map((item) => `${item.title}. ${item.summary}`),
  ].join(' ');

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbfb_0%,#f8fbff_42%,#ffffff_100%)] text-black dark:bg-dark-primary dark:text-dark-text">
      <Head>
        <title>{t('inspirationHub.metaTitle')}</title>
        <meta
          name="description"
          content={t('inspirationHub.metaDescription')}
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
              title={sectionTitle}
              subtitle={sectionSubtitle}
              voiceText={voiceText}
            />
          </motion.div>

          <div className="mt-8 grid gap-8 lg:gap-10">
            {droneTvSettings ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45 }}
              >
                <DroneTVSection
                  items={content.scenicMediaItems}
                  videoEmbedUrl={droneTvSettings?.embedUrl}
                  videoTitle={droneTvSettings?.title}
                  videoSubtitle={droneTvSettings?.subtitle}
                />
              </motion.div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <DailyWondersSection quotes={content.dailyWonderQuotes} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <PositiveStoriesSection items={content.positiveStoryItems} />
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
