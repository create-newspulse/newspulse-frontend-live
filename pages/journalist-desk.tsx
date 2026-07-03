import Link from 'next/link';
import React from 'react';
import { CheckCircle2, ClipboardList, FilePenLine, Mail, Newspaper, SearchCheck, ShieldCheck, UserRoundCheck, Users, Video } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.team@gmail.com';
const suggestedSubject = 'Journalist Pitch - [Topic] - [Your Name]';

const contributorCards = [
  {
    title: 'Journalists',
    body: 'Professional reporters and journalists with serious story pitches, field reports, interviews, or public-interest submissions.',
    Icon: Newspaper,
  },
  {
    title: 'Writers',
    body: 'Writers and columnists who want to submit original explainers, reported features, opinion proposals, or drafts for review.',
    Icon: FilePenLine,
  },
  {
    title: 'Regional Reporters',
    body: 'Contributors following local developments, civic issues, community concerns, or region-specific public-interest reporting.',
    Icon: Users,
  },
  {
    title: 'Editors',
    body: 'Editors and editorial collaborators who want to discuss content support, review ideas, or newsroom collaboration.',
    Icon: UserRoundCheck,
  },
  {
    title: 'Researchers',
    body: 'Researchers and subject-matter contributors who can support reporting with verified documents, context, or evidence.',
    Icon: SearchCheck,
  },
  {
    title: 'Photo/Video Contributors',
    body: 'Photo and video contributors who can legally share original visuals or supporting material for editorial review.',
    Icon: Video,
  },
] as const;

const trustCards = [
  {
    title: 'Editorial Review',
    body: 'All submissions are subject to editorial review, verification, and approval before publication.',
    Icon: ClipboardList,
  },
  {
    title: 'Source Verification',
    body: 'Contributors should provide clear sources, supporting details, or evidence wherever applicable.',
    Icon: SearchCheck,
  },
  {
    title: 'Ethical Standards',
    body: 'Submissions must follow News Pulse editorial, legal, copyright, privacy, and responsible journalism standards.',
    Icon: ShieldCheck,
  },
  {
    title: 'Bylines Subject to Approval',
    body: 'Bylines, credits, contributor tags, and author profiles remain subject to editorial approval.',
    Icon: CheckCircle2,
  },
] as const;

const pitchChecklist = [
  'Full name',
  'Email address',
  'City/state',
  'Professional background or experience',
  'Story headline or topic',
  'Short summary of the story',
  'Why the story matters',
  'Sources or supporting details',
  'Whether the content is original and unpublished',
  'Any photos, videos, or documents, if available',
] as const;

const ethicalRestrictions = [
  'Plagiarised content',
  'Fake news or rumours',
  'Defamatory or baseless allegations',
  'Hate speech',
  'Communal, caste, religious, or political provocation',
  'Private personal information without proper basis',
  'Copyrighted material without permission',
  'Manipulated or misleading visuals',
  'Unsafe or unlawful reporting methods',
] as const;

export default function JournalistDeskPage() {
  return (
    <PublicBusinessPageLayout
      title="Journalist Desk"
      description="For professional story pitches, contributor submissions, and editorial collaboration with News Pulse."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Email News Pulse journalist desk"
      contactTitle="Email News Pulse journalist desk"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <SurfacePanel className="min-w-0 overflow-hidden sm:p-10">
          <PageEyebrow tone="slate">Journalist Desk</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Journalist Desk
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">
            For professional story pitches, contributor submissions, and editorial collaboration.
          </div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            The News Pulse Journalist Desk is for journalists, writers, contributors, editors, regional reporters, and media professionals who want to share story ideas, article pitches, field reports, interviews, explainers, or public-interest reports with News Pulse.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            All submissions are subject to editorial review, verification, and approval before publication.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Submit a Pitch
            </a>
            <Link href="/editorial-policy" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Editorial Policy
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Submission note</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Serious editorial submissions only</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            Submitting a pitch or article does not guarantee publication, payment, assignment, or formal association with News Pulse.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Original, accurate, lawful, and properly sourced material is expected.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">News Pulse may edit, verify, accept, reject, hold, update, or remove submissions based on editorial requirements.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Submitting content does not make anyone an employee, agent, representative, authorised journalist, or official spokesperson of News Pulse.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contributorCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
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

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Who Can Submit" kicker="1" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>The Journalist Desk is intended for professional journalists, independent contributors, writers and columnists, regional reporters, editors and researchers, photo or video contributors, subject-matter contributors, and freelance media professionals.</p>
            <p>Submitting a pitch or article does not guarantee publication, payment, assignment, or formal association with News Pulse.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="What You Can Submit" kicker="2" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>You may submit story pitches, draft articles, field reports, interview ideas, explainerships, opinion or editorial proposals, regional reports, public-interest investigations, and photos, videos, or supporting documents where legally shareable.</p>
            <p>All submitted material must be original, accurate, lawful, and properly sourced.</p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Story Pitch Process" kicker="3" />
          <p className="mt-5 text-sm leading-7 text-slate-600">When submitting a story pitch, please include the following details:</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pitchChecklist.map((item) => (
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
            <p className="mt-4 text-sm leading-7 text-slate-600">
              News Pulse will use your submitted details only for verification, editorial communication, and contributor management.
            </p>
            <div className="mt-5 text-sm font-semibold text-slate-800">Suggested subject line</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              {suggestedSubject}
            </div>
            <div className="mt-5 text-sm font-semibold text-slate-800">Example</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Journalist Pitch - Civic Water Issue in Ahmedabad - Rahul Sharma
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Editorial Review Required" kicker="4" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>All journalist and contributor submissions may be reviewed by News Pulse before publication.</p>
            <p>News Pulse may edit, verify, accept, reject, hold, update, or remove submitted content based on editorial standards, accuracy, legality, safety, relevance, copyright, public interest, and ethical requirements.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Source Verification Required" kicker="5" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Journalists and contributors must provide clear sources wherever applicable.</p>
            <p>Sources may include official records, public documents, direct confirmations, field notes, photographs, videos, verified statements, interviews, or other credible evidence.</p>
            <p>News Pulse may request additional clarification or supporting material before considering publication.</p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Bylines and Credit" kicker="6" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Bylines, credits, contributor tags, journalist tags, or author profiles are subject to editorial approval.</p>
            <p>News Pulse may decide whether to publish content with a byline, staff credit, contributor credit, anonymous source reference, or no public credit, depending on the nature of the submission and editorial requirements.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Ethical Standards" kicker="7" />
          <p className="mt-5 text-sm leading-7 text-slate-600">All journalists and contributors must follow News Pulse Editorial Policy, Digital Code of Ethics, Copyright Policy, Privacy Policy, and responsible journalism standards.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {ethicalRestrictions.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_320px]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="No Official Representation" kicker="8" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Submitting content to the Journalist Desk does not make the submitter an employee, agent, representative, authorised journalist, or official spokesperson of News Pulse.</p>
            <p>Any formal contributor, journalist, or assignment relationship must be confirmed separately in writing by News Pulse.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <Mail className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Submit serious editorial proposals</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Submit serious story pitches, field reports, and contributor proposals for editorial review by News Pulse.
          </p>
          <a href={`mailto:${contactEmail}`} className="mt-4 inline-flex break-all text-sm font-semibold text-sky-700 underline">
            {contactEmail}
          </a>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Contact" kicker="9" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                For journalist pitches, article submissions, contributor proposals, and editorial collaboration, use the contact details below.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Email Journalist Desk
                </a>
                <Link href="/digital-code-of-ethics" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Digital Code of Ethics
                </Link>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.26)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact details</div>
              <a href={`mailto:${contactEmail}`} className="mt-3 inline-flex break-all text-sm font-semibold text-sky-700 underline">
                {contactEmail}
              </a>
              <a href="https://www.newspulse.co.in" className="mt-3 block text-sm font-semibold text-sky-700 underline">
                www.newspulse.co.in
              </a>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}
