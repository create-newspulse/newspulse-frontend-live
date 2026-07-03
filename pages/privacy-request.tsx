import React from 'react';
import { ClipboardList, Mail, ShieldCheck, UserRoundCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'privacy@newspulse.co.in';

const requestTypes = [
  'Access my personal data',
  'Correct or update my personal data',
  'Delete or erase my personal data',
  'Withdraw consent',
  'Privacy/data grievance',
  'Other privacy request',
] as const;

const requestDetails = [
  'Full name',
  'Email/mobile used on News Pulse',
  'Request type',
  'Clear message',
  'Any reference ID, if available',
] as const;

export default function PrivacyRequestPage() {
  const mailSubject = 'Privacy Request - News Pulse';

  return (
    <PublicBusinessPageLayout
      title="Privacy Request"
      description="The News Pulse privacy request page explains how users can submit access, correction, deletion, withdrawal of consent, and privacy grievance requests by email."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`}
      contactAriaLabel="Email News Pulse privacy request desk"
      contactTitle="Email News Pulse privacy request desk"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Privacy request</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Privacy Request
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse uses this single public route for privacy and personal data requests. Users may request access, correction, update, deletion or erasure, withdrawal of consent, privacy grievance review, or other privacy-related support through the published privacy email.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            For this release, the page is informational only and does not connect to a backend privacy request API or automatic deletion workflow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Email Privacy Request
            </a>
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {contactEmail}
            </a>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Safety notice</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Requests are reviewed before action is taken.</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            Submitting a privacy request does not result in automatic deletion or automatic changes. News Pulse may verify your identity before processing any access, correction, deletion, withdrawal of consent, or privacy grievance request. Requests that appear false, duplicate, abusive, incomplete, or unauthorised may be rejected or closed after review. Please submit requests only for personal data that belongs to you. Do not impersonate another person or submit false or frivolous requests.
          </p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Request Types" kicker="What you can request" />
          <div className="mt-5 grid gap-3">
            {requestTypes.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <SectionHeading title="What to Include" kicker="Email checklist" />
          <div className="mt-5 grid gap-3">
            {requestDetails.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Identity verification may be requested only when necessary.
          </p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Privacy contact',
            body: contactEmail,
            Icon: Mail,
          },
          {
            title: 'Main rights page',
            body: 'Privacy Policy is the main News Pulse DPDP and privacy rights page.',
            Icon: UserRoundCheck,
          },
          {
            title: 'No automatic action',
            body: 'Requests are reviewed before any change is made to user data or consent handling.',
            Icon: ShieldCheck,
          },
        ].map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>
    </PublicBusinessPageLayout>
  );
}