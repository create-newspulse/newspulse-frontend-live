import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import YouthHero from '../components/youth/YouthHero';
import CategoryGrid from '../components/youth/CategoryGrid';
import FeaturedStories from '../components/youth/FeaturedStories';
import YouthSpotlight from '../components/youth/YouthSpotlight';
import SubmitStoryModal from '../components/youth/SubmitStoryModal';
import { useYouthPulse } from '../features/youthPulse/useYouthPulse';
import { usePublicFounderToggles } from '../hooks/usePublicFounderToggles';
import { fetchServerPublicFounderToggles, type PublicFounderToggles } from '../lib/publicFounderToggles';

type YouthPulsePageProps = {
  initialFounderToggles: PublicFounderToggles;
};

export default function YouthPulsePage({ initialFounderToggles }: YouthPulsePageProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const submissionRef = useRef<HTMLElement>(null);
  const { toggles } = usePublicFounderToggles(initialFounderToggles);

  const view = typeof router.query?.view === 'string' ? router.query.view : '';
  const isViewAll = view.toLowerCase() === 'all';
  const { topics, trending, error } = useYouthPulse(isViewAll ? 30 : 12);
  const submissionsClosed = toggles.youthPulseSubmissionsClosed;
  const spotlightStories = trending.slice(0, Math.min(4, trending.length));
  const latestStories = trending.slice(0, isViewAll ? 6 : 3);

  useEffect(() => {
    if (submissionsClosed && open) {
      setOpen(false);
    }
  }, [submissionsClosed, open]);

  const scrollToCategories = () => {
    catRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToSubmissionForm = () => {
    submissionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openSubmitModal = () => {
    if (submissionsClosed) return;
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7fbff_0%,_#ffffff_18%,_#fffdf9_58%,_#ffffff_100%)] text-black dark:bg-dark-primary dark:text-dark-text">
      <Head>
        <title>🎓 Youth Pulse • News Pulse</title>
        <meta
          name="description"
          content="Youth Pulse is the youth-focused News Pulse section for campus stories, exams, careers, achievers, and reviewed student voices."
        />
      </Head>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <YouthHero onExplore={scrollToCategories} onGoToSubmissionForm={scrollToSubmissionForm} />

        <YouthSpotlight stories={spotlightStories as any} />

        <FeaturedStories
          id="latest"
          stories={latestStories as any}
          error={error}
          title="Latest from Youth Pulse"
          description="Live, published Youth Pulse stories from across the News Pulse youth vertical."
          emptyMessage="No published Youth Pulse stories are live yet."
          ctaHref="/youth-pulse?view=all#latest"
          ctaLabel="View more live stories →"
        />

        <div ref={catRef}>
          <CategoryGrid categories={topics as any} />
        </div>

        <section
          id="submission-form"
          ref={submissionRef}
          className="mt-12 overflow-hidden rounded-[2rem] border border-slate-200/85 bg-[linear-gradient(135deg,_rgba(224,242,254,0.95),_rgba(255,247,237,0.92))] p-8 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-300">
                Contribution pathway
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Share your story with the News Pulse review desk
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-300">
                Bring us a campus development, exam update, youth achievement, civic issue, career lead, or a strong
                youth perspective. Youth Pulse welcomes contributions, but publication remains moderation-first and
                editorially reviewed.
              </p>
              <div className="mt-5 rounded-2xl border border-white/70 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700 backdrop-blur dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                {submissionsClosed
                  ? 'Youth Pulse submissions are temporarily closed.'
                  : 'Submissions are reviewed by News Pulse before publication. Public readers see only approved published stories.'}
              </div>
              <div className="mt-6">
                <button
                  onClick={openSubmitModal}
                  disabled={submissionsClosed}
                  className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.42)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Submit to Youth Pulse
                </button>
              </div>
            </div>
            <aside className="rounded-[1.75rem] border border-white/80 bg-white/72 p-6 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.22)] backdrop-blur dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                What belongs here
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                <li>Campus developments with public relevance</li>
                <li>Exam or career explainers that help real readers</li>
                <li>Youth achievements, innovations, and grounded perspectives</li>
                <li>Clear, factual submissions that can stand up to review</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-slate-200/85 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.95))] p-6 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            Trust and moderation
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Youth Pulse is open to contributions, but not open to unreviewed publishing
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Public readers see only approved published stories. That keeps Youth Pulse credible as a News Pulse
            editorial destination while still creating room for new youth voices, fresh reporting, and ambitious ideas.
          </p>
        </section>
      </main>

      <SubmitStoryModal open={open} onClose={() => setOpen(false)} submissionsOpen={!submissionsClosed} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<YouthPulsePageProps> = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  const initialFounderToggles = await fetchServerPublicFounderToggles();
  return {
    props: {
      initialFounderToggles,
      messages: await getMessages(locale as string),
    },
  };
};
