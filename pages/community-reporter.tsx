import Link from 'next/link';
import React from 'react';
import { AlertTriangle, Camera, CheckCircle2, FileCheck, Mail, MapPinned, Megaphone, ShieldCheck, Users } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.team@gmail.com';
const suggestedSubject = 'Community Report - [City] - [Topic]';

const submissionCards = [
  {
    title: 'Local Issues',
    body: 'Road safety, sanitation, water, electricity, transport, accessibility, or other local issues that affect daily life.',
    Icon: MapPinned,
  },
  {
    title: 'Civic Problems',
    body: 'Public problems, complaints, infrastructure concerns, or issues that may need public attention or follow-up.',
    Icon: Megaphone,
  },
  {
    title: 'Events',
    body: 'Community events, local gatherings, school activities, cultural programmes, and public-interest happenings.',
    Icon: Users,
  },
  {
    title: 'Positive Stories',
    body: 'Constructive local efforts, community achievements, public service actions, and stories worth highlighting.',
    Icon: CheckCircle2,
  },
  {
    title: 'Photos & Videos',
    body: 'Visual material from public events or local issues, provided you have the right to share it responsibly.',
    Icon: Camera,
  },
  {
    title: 'Public Interest',
    body: 'Tips, updates, and information that can help the public understand an issue that matters locally.',
    Icon: ShieldCheck,
  },
] as const;

const verificationPoints = [
  'Date and location',
  'Source of information',
  'Photo or video authenticity',
  'Public interest value',
  'Legal and safety concerns',
  'Whether the content may harm someone unfairly',
  'Whether the content is copied, misleading, or defamatory',
] as const;

const restrictedContent = [
  'Fake news or rumours',
  'Hate speech',
  'Communal, caste, religious, or political provocation',
  'Defamatory or baseless allegations',
  'Copyrighted photos, videos, or text without permission',
  'Private personal information of others',
  'Content involving minors or victims without proper care',
  'Edited, misleading, or manipulated visuals',
  'Promotional or spam content',
  'Illegal, abusive, or unsafe material',
] as const;

const submissionChecklist = [
  'Full name',
  'City/state',
  'Contact email',
  'Topic or headline',
  'Date and location of the issue or event',
  'Clear description',
  'Photos or videos, if available',
  'Source or supporting details, if any',
] as const;

export default function CommunityReporterPage() {
  return (
    <PublicBusinessPageLayout
      title="Community Reporter"
      description="Your local voice can make a difference. Share local issues, civic updates, positive stories, and public-interest information with News Pulse."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Email News Pulse community reporting desk"
      contactTitle="Email News Pulse community reporting desk"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <SurfacePanel className="min-w-0 overflow-hidden sm:p-10">
          <PageEyebrow tone="slate">Community Reporter</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Community Reporter
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">Your local voice can make a difference.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse welcomes responsible community updates from readers, citizens, students, local contributors, and public-minded individuals who want to share important local information.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Community Reporter is a space for local news tips, civic issues, public-interest updates, photos, videos, events, and stories that deserve attention.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Submit by Email
            </a>
            <Link href="/editorial-policy" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Editorial Policy
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Safety and verification</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Community submissions are reviewed before publication</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            Submission does not guarantee publication. News Pulse may review, verify, hold, reject, edit, or remove submissions based on accuracy, legality, safety, relevance, copyright, ethical standards, and public interest.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Do not put yourself or others at risk while gathering information.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Do not enter restricted areas, interfere with emergency services, or break any law while reporting an issue.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Community submissions do not make the submitter an employee, journalist, representative, agent, or authorised spokesperson of News Pulse.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {submissionCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="What You Can Submit" kicker="1" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            You may submit information related to local civic issues, public problems or complaints, community events, positive local stories, public safety updates, education and youth-related updates, local development issues, photos or videos from public events, and story ideas or news tips.
          </p>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <FileCheck className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Verification Notice</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            All community submissions may be reviewed before publication. News Pulse may verify the following points where needed.
          </p>
          <div className="mt-5 space-y-3">
            {verificationPoints.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Verification Before Publication" kicker="2" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            News Pulse may verify details such as date and location, source of information, photo or video authenticity, public interest value, legal and safety concerns, whether content may harm someone unfairly, and whether the material is copied, misleading, or defamatory.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">Submission does not guarantee publication.</p>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="What Is Not Allowed" kicker="3" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {restrictedContent.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">News Pulse may reject or remove any submission that violates these standards.</p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Responsibility of the Submitter" kicker="4" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>By submitting information to News Pulse, you confirm that the information provided by you is true to the best of your knowledge and that you have the right to share any photos, videos, or documents submitted.</p>
            <p>You should not put yourself or others at risk while collecting information. Do not enter restricted areas, disturb authorities, interfere with emergency services, or break any law while reporting an issue.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="No Official Representation" kicker="5" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Submitting a community report does not make the submitter an employee, journalist, representative, agent, or authorised spokesperson of News Pulse.</p>
            <p>Community submissions are reviewed by News Pulse before any publication decision.</p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="How to Submit" kicker="6" />
          <p className="mt-5 text-sm leading-7 text-slate-600">You can send your community report with the following details:</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {submissionChecklist.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Submit by Email" kicker="Suggested format" />
          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="text-sm font-semibold text-slate-800">Email</div>
            <a href={`mailto:${contactEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
              {contactEmail}
            </a>
            <div className="mt-5 text-sm font-semibold text-slate-800">Suggested subject line</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              {suggestedSubject}
            </div>
            <div className="mt-5 text-sm font-semibold text-slate-800">Example</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Community Report - Ahmedabad - Road Damage Near School
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Editorial Review" kicker="7" />
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                <p>News Pulse may edit, verify, hold, reject, or remove community-submitted content based on accuracy, legality, safety, relevance, copyright, ethical standards, and public interest.</p>
                <p>All community submissions must follow News Pulse Editorial Policy and Digital Code of Ethics.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Submit by Email
                </a>
                <Link href="/digital-code-of-ethics" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Digital Code of Ethics
                </Link>
              </div>
            </div>

            <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.28)]">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Submit carefully and responsibly</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Share local issues, civic updates, positive stories, and public-interest information with News Pulse, but only submit material you can share lawfully and responsibly.
              </p>
              <a href={`mailto:${contactEmail}`} className="mt-4 inline-flex break-all text-sm font-semibold text-sky-700 underline">
                {contactEmail}
              </a>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}