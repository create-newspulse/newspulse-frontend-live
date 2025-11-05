import Head from 'next/head';
import { useRef, useState } from 'react';
import YouthHero from '../components/youth/YouthHero';
import CategoryGrid from '../components/youth/CategoryGrid';
import FeaturedStories from '../components/youth/FeaturedStories';
import SubmitStoryModal from '../components/youth/SubmitStoryModal';
import { youthCategories, youthStories } from '../utils/youthData';

export default function YouthPulsePage() {
  const [open, setOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

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
          <CategoryGrid categories={youthCategories} />
        </div>

        {/* Hide Inspiration Hub items from Youth Pulse featured stories */}
        <FeaturedStories
          stories={youthStories.filter((s) => s.category.toLowerCase() !== 'inspiration hub'.toLowerCase()).slice(0, 5)}
        />
      </main>

      <SubmitStoryModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
