import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import React from 'react';
import { Briefcase, Clock3, Globe, GraduationCap, Mail, Newspaper, ShieldAlert, Users } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const generalEmail = 'newspulse.admin@gmail.com';
const contactEmail = 'newspulse.team@gmail.com';
const grievanceEmail = 'grievance@newspulse.co.in';
const adsEmail = 'newspulse.ads@gmail.com';

type ContactPageProps = {
  initialType: string | null;
};

const grievanceChecklist = [
  'Your full name',
  'Email address',
  'Article or page URL',
  'Complaint type',
  'Clear explanation of the issue',
  'Supporting documents or evidence, if any',
] as const;

const topContactCards = [
  {
    title: 'General Contact',
    body: 'For general questions, feedback, website issues, or basic communication.',
    value: generalEmail,
    href: `mailto:${generalEmail}`,
    Icon: Mail,
    highlight: false,
  },
  {
    title: 'Editorial / News Desk',
    body: 'For story suggestions, news tips, editorial feedback, or content-related communication.',
    value: contactEmail,
    href: `mailto:${contactEmail}`,
    Icon: Newspaper,
    highlight: false,
  },
  {
    title: 'Grievance Redressal',
    body: 'For complaints related to published content, corrections, privacy concerns, copyright concerns, or ethical issues.',
    value: grievanceEmail,
    href: `mailto:${grievanceEmail}`,
    Icon: ShieldAlert,
    highlight: true,
  },
  {
    title: 'Advertising and Business',
    body: 'For advertising, sponsorships, brand collaborations, partnerships, or business enquiries.',
    value: adsEmail,
    href: `mailto:${adsEmail}`,
    Icon: Briefcase,
    highlight: false,
  },
] as const;

export default function ContactPage({ initialType }: ContactPageProps) {
  const highlightCopyright = String(initialType || '').trim().toLowerCase() === 'copyright';

  return (
    <PublicBusinessPageLayout
      title="Contact News Pulse"
      description="Contact News Pulse through the appropriate public channel for general, editorial, grievance, advertising, contributor, or business communication."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Email the News Pulse editorial team"
      contactTitle="Email the News Pulse editorial team"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Public contact and support</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Contact News Pulse
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">We&apos;re here to listen.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Readers, contributors, community reporters, advertisers, and partners can contact News Pulse through the channels below. Please choose the right contact purpose so the message can be reviewed properly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/grievance-redressal" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Grievance Redressal
            </Link>
            <Link href="/community-reporter" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Community Reporter
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Contact overview</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Choose the right channel</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            News Pulse provides dedicated public routes for general communication, editorial feedback, grievances, business enquiries, and community participation.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">General contact for basic questions and website issues</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Editorial desk for tips, story suggestions, and content-related communication</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Grievance email for complaints, corrections, privacy, copyright, or ethical concerns</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topContactCards.map(({ title, body, value, href, Icon, highlight }) => {
          const isHighlighted = highlightCopyright && title === 'Grievance Redressal';
          return (
            <SurfacePanel
              key={title}
              className={`min-w-0 p-5 ${isHighlighted ? 'border-amber-300 bg-amber-50/70' : ''}`}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              <a href={href} className="mt-4 inline-flex break-all text-sm font-semibold text-sky-700 underline">
                {value}
              </a>
              {isHighlighted ? <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Recommended for copyright and complaint requests</div> : null}
            </SurfacePanel>
          );
        })}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Grievance Redressal" kicker="Required details" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            For complaints related to published content, corrections, privacy concerns, copyright concerns, or ethical issues, please contact the grievance channel and include the relevant details below.
          </p>
          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="text-sm font-semibold text-slate-800">Grievance Email</div>
            <a href={`mailto:${grievanceEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
              {grievanceEmail}
            </a>
          </div>
          <div className="mt-5 space-y-3">
            {grievanceChecklist.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Grievances will be reviewed in good faith and handled according to the News Pulse grievance redressal process.
          </p>
        </SurfacePanel>

        <div className="grid gap-5">
          <SurfacePanel className="min-w-0">
            <SectionHeading title="Community Reporter Submissions" kicker="Public participation" />
            <p className="mt-5 text-sm leading-7 text-slate-600">
              For local news tips, photos, videos, civic issues, public-interest updates, or community reports, please use the Community Reporter page or contact the editorial team.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/community-reporter" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Community Reporter
              </Link>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Submission does not guarantee publication. All submissions may be reviewed for accuracy, legality, safety, relevance, and editorial suitability.
            </p>
          </SurfacePanel>

          <SurfacePanel className="min-w-0">
            <SectionHeading title="Careers and Contributor Enquiries" kicker="Routes" />
            <p className="mt-5 text-sm leading-7 text-slate-600">
              For career, internship, contributor, writer, translator, editor, or journalist-related enquiries, use the public routes below.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/careers" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <GraduationCap className="mr-2 h-4 w-4" /> Careers
              </Link>
              <Link href="/journalist-desk" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Newspaper className="mr-2 h-4 w-4" /> Journalist Desk
              </Link>
            </div>
          </SurfacePanel>
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Website" kicker="Public site" />
          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
              <Globe className="h-4 w-4 text-slate-600" />
              <a href="https://www.newspulse.co.in" className="text-sky-700 underline">www.newspulse.co.in</a>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Response Time" kicker="Note" />
          <div className="mt-5 flex gap-3 rounded-[24px] border border-slate-200/80 bg-white p-5 text-sm leading-7 text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <Clock3 className="mt-1 h-4 w-4 shrink-0 text-slate-700" />
            <span>
              News Pulse aims to review messages as soon as reasonably possible. Response time may vary depending on the nature of the request, message volume, and any verification required. For urgent legal, grievance, copyright, or correction-related matters, please use the correct email and provide complete details.
            </span>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Contact Summary" kicker="Quick reference" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Use the general contact address for basic communication, the editorial address for story or content-related matters, the grievance email for complaints and corrections, and the ads email for business or promotional enquiries.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.26)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Editorial / News Desk</div>
              <div className="mt-3 text-lg font-black tracking-tight text-slate-950">News Pulse</div>
              <a href={`mailto:${contactEmail}`} className="mt-3 inline-flex break-all text-sm font-semibold text-sky-700 underline">
                {contactEmail}
              </a>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                News Pulse will use your name, email/mobile, and message only to respond to your inquiry.
              </p>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ContactPageProps> = async (context) => ({
  props: {
    initialType: String(context.query.type || '').trim() || null,
  },
});