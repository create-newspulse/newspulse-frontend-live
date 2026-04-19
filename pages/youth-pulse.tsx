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
  const latestStories = trending.slice(0, isViewAll ? 6 : 3);
  const curatedStories = (isViewAll ? trending.slice(6) : trending.slice(3, 9)).filter(Boolean);
  const curatedFallback = latestStories.slice(0, Math.min(6, latestStories.length));

  const scrollToCategories = () => {
    catRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>🎓 Youth Pulse • News Pulse</title>
        <meta
          name="description"
          content="Youth Pulse is the youth-focused News Pulse section for campus stories, exams, careers, achievers, and reviewed student voices."
        />
      </Head>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <YouthHero onExplore={scrollToCategories} onSubmit={() => setOpen(true)} />

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Curated editorial stories</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Youth Pulse highlights published News Pulse reporting on student life, campus issues, exams, careers,
              and young achievers.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Moderated student submissions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Students can send story ideas, first-hand accounts, and tips, but nothing appears publicly without
              News Pulse review.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Published after review</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              The public page shows only approved, published Youth Pulse stories. Pending submissions stay in the
              review workflow.
            </p>
          </article>
        </section>

        <div ref={catRef}>
          <CategoryGrid categories={topics as any} />
        </div>

        <FeaturedStories
          id="latest"
          stories={latestStories as any}
          error={error}
          title="Latest from Youth Pulse"
          description="Live, published Youth Pulse stories from across News Pulse's youth coverage."
          emptyMessage="No published Youth Pulse stories are live yet."
          ctaHref="/youth-pulse?view=all#latest"
          ctaLabel="View more live stories →"
        />

        <FeaturedStories
          id="curated"
          stories={(curatedStories.length ? curatedStories : curatedFallback) as any}
          error={error}
          title="Curated Youth Pulse story grid"
          description="Editorially selected Youth Pulse reads across campus, exams, careers, achievers, and student voices."
          emptyMessage="Curated Youth Pulse stories will appear here after publication."
          ctaHref="/youth-pulse?view=all#curated"
          ctaLabel={isViewAll ? 'Showing full Youth Pulse feed' : 'Open the full Youth Pulse feed →'}
        />

        <section className="mt-12 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.08),_rgba(249,115,22,0.10))] p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              Submit Your Story
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Send a Youth Pulse story to the News Pulse review desk
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-300">
              Share a campus development, exam update, career lead, youth achievement, or student perspective.
              Submissions are reviewed by News Pulse before publication.
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700 backdrop-blur dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
              Public readers see only published Youth Pulse stories. Contributor details and pending submissions stay
              inside the admin review workflow.
            </div>
            <div className="mt-6">
              <button
                onClick={() => setOpen(true)}
                className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                Open Submission Form
              </button>
            </div>
          </div>
        </section>
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
