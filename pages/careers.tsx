import React from 'react';
import Link from 'next/link';
import { BadgeCheck, Briefcase, FileText, HeartHandshake, Languages, Mail, PencilLine, Scale, SearchCheck, ShieldCheck, Video, Users } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.team@gmail.com';

const roleCards = [
  { title: 'Writers', Icon: PencilLine },
  { title: 'Editors', Icon: FileText },
  { title: 'Interns', Icon: Briefcase },
  { title: 'Video Editors', Icon: Video },
  { title: 'Translators', Icon: Languages },
  { title: 'Regional Contributors', Icon: Users },
  { title: 'Community Reporters', Icon: Users },
  { title: 'Social Media Contributors', Icon: Users },
  { title: 'Research and Fact-Check Support', Icon: SearchCheck },
  { title: 'Design and Visual Content Support', Icon: BadgeCheck },
] as const;

const valuesCards = [
  {
    title: 'Accuracy',
    body: 'We value people who care about getting facts right and presenting information clearly.',
    Icon: ShieldCheck,
  },
  {
    title: 'Ethics',
    body: 'Responsible journalism requires fairness, care, privacy awareness, and editorial responsibility.',
    Icon: Scale,
  },
  {
    title: 'Original Work',
    body: 'We look for contributors who create original material and avoid plagiarism or misleading presentation.',
    Icon: PencilLine,
  },
  {
    title: 'Public Interest',
    body: 'Strong contributions help readers understand issues that matter in civic life, community reporting, and public understanding.',
    Icon: HeartHandshake,
  },
] as const;

const applicationDetails = [
  'Full name',
  'Email address',
  'Role of interest',
  'City/state',
  'Language skills',
  'Short introduction',
  'Resume or portfolio, if available',
  'Writing, video, or editing samples, if available',
] as const;

export default function CareersPage() {
  return (
    <PublicBusinessPageLayout
      title="Careers at News Pulse"
      description="Build the future of responsible digital journalism. News Pulse welcomes interest from writers, editors, interns, translators, and contributors who believe in responsible journalism."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Contact News Pulse about careers"
      contactTitle="Contact News Pulse about careers"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <SurfacePanel className="min-w-0 overflow-hidden sm:p-10">
          <PageEyebrow tone="slate">Careers and contributor interest</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Careers at News Pulse
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">Build the future of responsible digital journalism.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse is growing as a modern digital news platform focused on clarity, accuracy, public interest, and multilingual journalism. We welcome interest from passionate people who want to contribute to responsible news, storytelling, media, technology, and community reporting.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            At this stage, opportunities may open from time to time based on editorial, technical, regional, and content requirements. This page is meant to guide future interest, not to imply that all roles are open now.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Apply / Contact
            </a>
            <Link href="/journalist-desk" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Journalist Desk
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Opportunity note</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Future opportunities and contributor pathways</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            News Pulse welcomes passionate writers, editors, interns, translators, and contributors who believe in responsible journalism.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Availability may depend on current requirements, project stage, skills, language ability, location, and editorial needs.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Submitting interest does not guarantee selection, publication, payment, employment, internship, or assignment.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">All contributors and applicants are expected to follow editorial standards, ethical practices, and responsible reporting rules.</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
              Email News Pulse
            </a>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {valuesCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0">
          <SectionHeading
            title="Future Opportunities"
            kicker="1"
            description="News Pulse may consider future opportunities in areas such as the roles below. Availability may depend on current requirements, project stage, skills, language ability, location, and editorial needs."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {roleCards.map(({ title, Icon }) => (
              <div key={title} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm font-semibold text-slate-700 shadow-[0_14px_32px_-30px_rgba(15,23,42,0.26)]">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="mt-3 leading-6">{title}</div>
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="What We Look For" kicker="2" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>News Pulse values people who believe in accuracy and fairness, responsible reporting, public-interest journalism, clear writing and communication, respect for privacy and sensitive issues, source verification, and ethical digital media practices.</p>
            <p>We do not support plagiarism, misleading content, or careless reporting. Strong contributors show judgment, originality, and responsibility in how they gather and present information.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Writers, Editors, and Contributors" kicker="3" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Writers, editors, and contributors should be able to create clear, original, and responsible content. Submissions must not be copied, misleading, defamatory, hateful, unsafe, or against News Pulse editorial standards.</p>
            <p>All editorial work may be reviewed before publication.</p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Internships and Learning Opportunities" kicker="4" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>News Pulse may consider internship or learning opportunities in the future for students and beginners interested in journalism, editing, translation, digital media, content research, or public-interest reporting.</p>
            <p>Internship availability is not guaranteed and may depend on current requirements.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Regional Contributors" kicker="5" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>News Pulse may consider regional contributors for local updates, civic issues, community stories, public-interest reporting, and regional developments.</p>
            <p>Regional contributors must follow News Pulse editorial rules, source verification standards, and Digital Code of Ethics.</p>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="No Guarantee of Selection" kicker="6" />
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>Submitting interest, a resume, portfolio, sample article, or application does not guarantee selection, publication, payment, employment, internship, or assignment.</p>
            <p>News Pulse may accept, reject, hold, or respond to applications based on internal requirements.</p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="How to Apply" kicker="7" />
          <p className="mt-5 text-sm leading-7 text-slate-600">Interested applicants may contact News Pulse with the following details:</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {applicationDetails.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="text-sm font-semibold text-slate-800">Email</div>
            <a href={`mailto:${contactEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
              {contactEmail}
            </a>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Ethical Requirement" kicker="8" />
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                <p>All applicants, contributors, interns, and collaborators must follow News Pulse editorial standards, Digital Code of Ethics, copyright policy, privacy policy, and responsible journalism practices.</p>
                <p>News Pulse does not support plagiarism, fake news, hate speech, unlawful content, copied material, or irresponsible reporting.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Apply / Contact
                </a>
                <Link href="/digital-code-of-ethics" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Digital Code of Ethics
                </Link>
              </div>
            </div>

            <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.28)]">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Mail className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-black tracking-tight text-slate-950">Send contributor interest</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                If your background aligns with responsible journalism, clear communication, and public-interest reporting, you may contact News Pulse with your interest and relevant materials.
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