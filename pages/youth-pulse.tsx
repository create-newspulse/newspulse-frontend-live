import Head from 'next/head';
import { useRef, useState } from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import YouthHero from '../components/youth/YouthHero';
import CategoryGrid from '../components/youth/CategoryGrid';
import FeaturedStories from '../components/youth/FeaturedStories';
import SubmitStoryModal from '../components/youth/SubmitStoryModal';
import { useYouthPulse } from '../features/youthPulse/useYouthPulse';

export default function YouthPulsePage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const view = typeof router.query?.view === 'string' ? router.query.view : '';
  const isViewAll = view.toLowerCase() === 'all';
  const { topics, trending, error } = useYouthPulse(isViewAll ? 30 : 12);

  const scrollToCategories = () => {
    catRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>🎓 Youth Pulse • NewsPulse</title>
        <meta
          name="description"
          content="Your daily pulse on student life, campus buzz, exams, careers and young achievers."
        />
      </Head>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <YouthHero onExplore={scrollToCategories} onSubmit={() => setOpen(true)} />

        <div ref={catRef}>
          <CategoryGrid categories={topics as any} />
        </div>

        {/* Hide Inspiration Hub items from Youth Pulse featured stories */}
        <FeaturedStories stories={(isViewAll ? trending : trending.slice(0, 5)) as any} error={error} />
      </main>

      <SubmitStoryModal open={open} onClose={() => setOpen(false)} />
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
