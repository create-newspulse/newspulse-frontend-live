import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, Lightbulb, Mic, Rocket, Send, Sparkles } from 'lucide-react';

type Props = {
  onExplore: () => void;
  onGoToSubmissionForm: () => void;
};

const youthCards = [
  { title: 'Campus Buzz', description: 'Latest campus conversations', Icon: GraduationCap },
  { title: 'Exams & Careers', description: 'Opportunities and updates', Icon: BookOpen },
  { title: 'Young Achievers', description: 'Stories worth celebrating', Icon: Rocket },
  { title: 'Innovation', description: 'Ideas shaping tomorrow', Icon: Lightbulb },
  { title: 'Student Voices', description: 'Youth perspectives', Icon: Mic },
] as const;

export default function YouthHero({ onExplore, onGoToSubmissionForm }: Props) {
  return (
    <section className="youth-hero relative isolate overflow-hidden rounded-[2rem] border border-white/16 bg-[#07132d] text-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.68)]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(37,99,235,0.30),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(124,58,237,0.34),transparent_32%),radial-gradient(circle_at_72%_88%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#07132d_0%,#10245f_52%,#16143a_100%)]" />
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div aria-hidden="true" className="absolute -right-28 top-12 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-violet-400/18 blur-3xl" />

      <div className="relative grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.88fr)] lg:items-center lg:px-10 lg:py-11">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
            NEWS PULSE • YOUTH VERTICAL
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-[4.15rem] lg:leading-[0.95]">
            Youth Pulse
          </h1>

          <p className="mt-4 max-w-3xl text-2xl font-extrabold leading-tight text-cyan-100 sm:text-3xl">
            Ideas. Ambition. Campus. Careers. Change.
          </p>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100/88 sm:text-lg sm:leading-8">
            News Pulse&apos;s editorial space for the next generation, covering campus life, careers, competitive exams,
            innovation, young achievers and voices shaping tomorrow.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 shadow-[0_18px_38px_-22px_rgba(255,255,255,0.7)] transition hover:-translate-y-0.5 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-0"
            >
              Explore Youth Pulse
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onGoToSubmissionForm}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/24 bg-white/8 px-6 py-3 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/13 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 active:translate-y-0"
            >
              Share Your Story
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-6 inline-flex max-w-2xl items-start gap-3 rounded-2xl border border-white/16 bg-white/9 px-4 py-3 text-sm leading-6 text-slate-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
            <div>
              <span className="font-extrabold text-white">Curated by the News Pulse editorial desk. </span>
              Youth contributions are welcome. Editorial quality leads the experience.
            </div>
          </div>
        </div>

        <div className="relative min-w-0 lg:pl-4" aria-label="Youth Pulse editorial tracks">
          <div aria-hidden="true" className="absolute left-8 top-8 h-52 w-52 rounded-full bg-blue-400/20 blur-3xl" />
          <div aria-hidden="true" className="absolute bottom-8 right-3 h-44 w-44 rounded-full bg-violet-300/18 blur-3xl" />

          <div className="relative rounded-[1.75rem] border border-white/16 bg-white/10 p-4 shadow-[0_28px_70px_-38px_rgba(2,6,23,0.78)] backdrop-blur-xl sm:p-6 lg:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" aria-hidden="true" />
              Explore Youth Pulse
            </div>

            <div className="grid gap-3.5 lg:gap-4">
              {youthCards.map(({ title, description, Icon }, index) => (
                <div
                  key={title}
                  className="group flex min-h-[76px] w-full items-center rounded-3xl border border-white/14 bg-white/[0.085] p-3.5 shadow-[0_16px_42px_-32px_rgba(2,6,23,0.90)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/34 hover:bg-white/[0.12]"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex w-full items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/18 bg-cyan-200/10 text-cyan-100 transition group-hover:bg-cyan-200/16">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white">{title}</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-100/72">{description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .youth-hero {
          animation: youthHeroIn 560ms ease-out both;
        }

        @keyframes youthHeroIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .youth-hero,
          .youth-hero * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
