import Link from 'next/link';
import React from 'react';
import { Globe2, HeartHandshake, Languages, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'Newspulse.team@gmail.com';

const trustCards = [
  {
    title: 'Accuracy First',
    body: 'We aim to verify information carefully and present it with clarity before it reaches readers.',
    Icon: ShieldCheck,
  },
  {
    title: 'Public Interest',
    body: 'We focus on stories that matter in daily life, civic awareness, and community understanding.',
    Icon: Target,
  },
  {
    title: 'Multilingual Reach',
    body: 'News Pulse is being built to serve readers across languages, regions, and communities.',
    Icon: Languages,
  },
  {
    title: 'Responsible Journalism',
    body: 'Speed should never replace care. We value fairness, context, and accountability in reporting.',
    Icon: HeartHandshake,
  },
] as const;

const coverageAreas = [
  'Breaking',
  'Regional',
  'National',
  'International',
  'Business',
  'Technology',
  'Science',
  'Sports',
  'Entertainment',
  'Lifestyle',
  'Youth Pulse',
  'Community Reporter',
] as const;

const promisePoints = ['Accuracy', 'Fairness', 'Transparency', 'Corrections', 'Privacy', 'Responsible Journalism'] as const;

export default function AboutUsPage() {
  return (
    <PublicBusinessPageLayout
      title="About News Pulse"
      description="Learn about News Pulse, its editorial focus, and how readers can contact the team."
      contactEmail={contactEmail}
      contactHref="/contact"
      contactAriaLabel="Contact News Pulse"
      contactTitle="Contact News Pulse"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <SurfacePanel className="min-w-0 overflow-hidden sm:p-10">
          <PageEyebrow tone="slate">About News Pulse</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.2rem] sm:leading-[1.04]">
            About News Pulse
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.35rem]">Your pulse on what matters most.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse is a founder-led digital news platform created for readers who want clear, responsible, and multilingual news without unnecessary noise. We aim to make important stories easier to understand, easier to access, and more useful across regions, languages, and communities.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Contact Us
            </Link>
            <Link href="/grievance-redressal" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Grievance Redressal
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Reader-first newsroom
          </div>
          <div className="mt-5 text-2xl font-black tracking-tight">Built for clarity, context, and public trust.</div>
          <p className="mt-4 text-sm leading-7 text-white/74">
            We believe news should inform, not confuse. It should move quickly when needed, but never carelessly. News Pulse is being shaped around accuracy, fairness, transparency, and public interest.
          </p>
          <div className="mt-6 grid gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/74">Clear public routes for contact, grievance, privacy, editorial standards, and copyright</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/74">Coverage designed for readers following local, national, global, and community stories</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/74">A simple and mobile-friendly public experience that prioritizes readability</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {trustCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Who We Are" kicker="News Pulse" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              News Pulse is a modern digital news platform focused on helping readers follow important developments with greater clarity and less clutter. It exists to make news more understandable for people who want updates that are timely, useful, and responsibly presented.
            </p>
            <p>
              We are building a reader-first platform where stories are treated with context, care, and public responsibility. That includes breaking updates, regional reporting, broad national and international coverage, and space for youth and community voices.
            </p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Why it exists</div>
          <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Globe2 className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Clear news for modern readers</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              News Pulse is for readers who want a cleaner path through fast-moving news, with an emphasis on understanding what matters and why.
            </p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="What We Cover" kicker="Coverage" description="News Pulse covers stories that matter to everyday readers across public life, business, technology, culture, and community reporting." />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {coverageAreas.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm font-semibold text-slate-700 shadow-[0_14px_32px_-30px_rgba(15,23,42,0.26)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Our Promise" kicker="Standards" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            News Pulse is committed to responsible digital journalism. We aim to verify information, avoid misleading presentation, respect privacy, correct errors where needed, and publish with fairness, transparency, and accountability.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {promisePoints.map((item) => (
              <div key={item} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="For Our Readers" kicker="Reader-first" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              News Pulse is made for readers who want news that is simple, clear, useful, and trustworthy. Whether someone is following local updates, national affairs, global developments, or youth-focused stories, the goal is to make staying informed feel more accessible.
            </p>
            <p>
              We want readers to spend less time cutting through noise and more time understanding the stories that affect public life, daily decisions, and community conversations.
            </p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Connect With Us" kicker="Public routes" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Readers, contributors, and community members can connect with News Pulse through the public contact and grievance routes, or use the Community Reporter page to explore public participation.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Contact Us
                </Link>
                <Link href="/grievance-redressal" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Grievance Redressal
                </Link>
                <Link href="/community-reporter" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Community Reporter
                </Link>
              </div>
            </div>

            <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.28)]">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Users className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Made for readers who value trust.</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                News Pulse is built to keep public-facing communication straightforward, accessible, and useful across the main reader help routes.
              </p>
              <div className="mt-4 text-sm font-semibold text-slate-700">Email: {contactEmail}</div>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}