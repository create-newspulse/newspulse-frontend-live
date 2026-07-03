import Link from 'next/link';
import React from 'react';
import { ClipboardList, FileText, Mail, ShieldCheck, UserRoundCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'privacy@newspulse.co.in';

const requestDetails = [
  'Full name',
  'Email/mobile used on News Pulse',
  'Request type: access / correction / deletion / withdraw consent / grievance',
  'Message explaining the request',
] as const;

const processCards = [
  {
    title: 'Static Instructions',
    body: 'This Release 1A page provides email instructions only. It does not connect to a backend privacy request API yet.',
    Icon: FileText,
  },
  {
    title: 'Verification When Needed',
    body: 'News Pulse may request identity verification only when necessary to confirm that a request is authentic and lawful.',
    Icon: UserRoundCheck,
  },
  {
    title: 'Privacy Channel',
    body: `Users may send privacy and DPDP requests to ${contactEmail}.`,
    Icon: Mail,
  },
] as const;

const requestTypes = [
  'Access personal data held by News Pulse, where applicable',
  'Correction or update of submitted personal information',
  'Deletion or erasure request for applicable personal data',
  'Withdrawal of consent for future processing where consent applies',
  'Grievance related to privacy or personal data handling',
] as const;

export default function DataDeletionRequestPage() {
  const mailSubject = 'Privacy Request - News Pulse';

  return (
    <PublicBusinessPageLayout
      title="Data Deletion Request"
      description="Instructions for News Pulse users to request access, correction, deletion, consent withdrawal, or privacy grievance support by email."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`}
      contactAriaLabel="Email News Pulse privacy request desk"
      contactTitle="Email News Pulse privacy request desk"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Privacy request instructions</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Data Deletion Request
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Users may email News Pulse to request access, correction, deletion, withdrawal of consent, or grievance review related to personal data submitted through public News Pulse channels.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            This page is currently a static instruction page. No backend privacy request API or automated deletion workflow is added in this release.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Email Request
            </a>
            <Link href="/dpdp-privacy-rights" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              DPDP / Privacy Rights
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Email checklist</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Include the details needed to review your request.</div>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            {requestDetails.map((item) => (
              <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">{item}</div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {processCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="How to Send a Request" kicker="Email format" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Send an email to the address below with a clear subject such as "Privacy Request - News Pulse" and include the required details.
          </p>
          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="text-sm font-semibold text-slate-800">Privacy / DPDP contact</div>
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
              {contactEmail}
            </a>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <SectionHeading title="Supported Request Types" kicker="Privacy requests" />
          <div className="mt-5 grid gap-3">
            {requestTypes.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <SectionHeading title="Identity Verification" kicker="Important note" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Identity verification may be requested only when necessary to confirm that the person making the request is authorised to do so, to prevent misuse, or to meet legal and security requirements.
          </p>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}