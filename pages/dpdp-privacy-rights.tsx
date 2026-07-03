import Link from 'next/link';
import React from 'react';
import { BadgeCheck, FilePenLine, ShieldCheck, Trash2, Undo2, UserRoundCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'grievance@newspulse.co.in';

const rightsCards = [
  {
    title: 'Access Personal Data',
    body: 'Users may request information about personal data submitted to News Pulse and how it may be used, where applicable.',
    Icon: UserRoundCheck,
  },
  {
    title: 'Correction / Update',
    body: 'Users may ask News Pulse to correct or update inaccurate or incomplete personal information submitted through public channels.',
    Icon: FilePenLine,
  },
  {
    title: 'Erasure / Deletion',
    body: 'Users may request deletion of applicable personal data, subject to legal, editorial, security, and record-retention requirements.',
    Icon: Trash2,
  },
  {
    title: 'Withdraw Consent',
    body: 'Users may withdraw consent for future processing where processing is based on consent and withdrawal is technically and legally applicable.',
    Icon: Undo2,
  },
  {
    title: 'Grievance Redressal',
    body: 'Users may raise privacy-related grievances through the published News Pulse grievance or privacy contact channel.',
    Icon: ShieldCheck,
  },
  {
    title: 'Nomination',
    body: 'Users may nominate another person for applicable data rights handling where such nomination is recognised under applicable law.',
    Icon: BadgeCheck,
  },
] as const;

const userDuties = [
  'Do not impersonate another person when making privacy or data requests.',
  'Do not submit false, misleading, or frivolous requests.',
  'Provide authentic information so News Pulse can review and verify requests where necessary.',
] as const;

const requestSteps = [
  'Review the right or request type that applies to your concern.',
  `Email News Pulse at ${contactEmail} with your full name, email/mobile used on News Pulse, request type, and message.`,
  'Provide additional verification only if News Pulse reasonably requests it for identity, security, or legal reasons.',
] as const;

export default function DpdpPrivacyRightsPage() {
  const mailSubject = 'DPDP Privacy Rights Request - News Pulse';

  return (
    <PublicBusinessPageLayout
      title="DPDP / Privacy Rights"
      description="Information about News Pulse user privacy rights and duties, including access, correction, erasure, consent withdrawal, grievance redressal, and nomination."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`}
      contactAriaLabel="Email News Pulse about DPDP privacy rights"
      contactTitle="Email News Pulse about DPDP privacy rights"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">DPDP and privacy rights</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            DPDP / Privacy Rights
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse respects user privacy and provides public information about privacy rights related to personal data submitted through News Pulse channels. This page explains key rights and user duties in plain language.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/data-deletion-request" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Data Deletion Request
            </Link>
            <Link href="/privacy-policy" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Privacy Policy
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Request channel</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Use the published privacy/grievance email for now.</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            Until a dedicated privacy address is configured, DPDP and privacy rights requests may be sent to {contactEmail}.
          </p>
          <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="mt-6 inline-flex break-all text-sm font-semibold text-white underline">
            {contactEmail}
          </a>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rightsCards.map(({ title, body, Icon }) => (
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
          <SectionHeading title="User Duties" kicker="Responsible requests" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Users making privacy requests should act honestly and provide accurate information so News Pulse can review requests safely and fairly.
          </p>
          <div className="mt-5 grid gap-3">
            {userDuties.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <SectionHeading title="How to Exercise Rights" kicker="Request steps" />
          <div className="mt-5 grid gap-3">
            {requestSteps.map((item, index) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                <span className="mr-2 font-black text-slate-950">{index + 1}.</span>
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Related Privacy Pages" kicker="News Pulse" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Users can also review the Privacy Policy, Cookie Policy, and Data Deletion Request instructions for more details about public privacy handling.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/privacy-policy" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Privacy Policy
              </Link>
              <Link href="/cookie-policy" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Cookie Policy
              </Link>
              <Link href="/data-deletion-request" className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Data Deletion Request
              </Link>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}