import React from 'react';
import { AlertTriangle, BadgeCheck, FileCheck2, Gavel, Mail, Shield, ShieldAlert } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.ads@gmail.com';

export default function AdvertisingPolicyPage() {
  return (
    <PublicBusinessPageLayout
      title="Advertising Policy"
      description="The News Pulse advertising policy outlines the standards used to review public advertising, sponsorships, and branded content in order to protect readers, brand partners, and editorial trust."
      contactEmail={contactEmail}
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <SurfacePanel className="sm:p-10">
          <PageEyebrow tone="slate">Public ad acceptance and sponsorship standards</PageEyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Advertising on News Pulse must remain clearly disclosed, safe, and compliant.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            This page explains the public standards used to review advertising, sponsorships, and branded content before publication and while campaigns remain live. It is a trust and compliance reference, not a sales or inventory guide.
          </p>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Policy focus</div>
          <div className="mt-2 text-2xl font-black tracking-tight">What this page covers</div>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Disclosure and editorial separation</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Acceptance standards and restricted categories</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Destination safety, compliance, and enforcement</div>
          </div>
          <div className="mt-6">
            <ContactPill email={contactEmail} label="Contact for policy questions" />
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[
          { icon: Shield, title: 'Trust', body: 'Readers should always be able to identify sponsored or promoted material clearly and without confusion.' },
          { icon: BadgeCheck, title: 'Disclosure', body: 'Sponsored executions must include appropriate labeling and disclosure rules that preserve editorial distinction.' },
          { icon: FileCheck2, title: 'Compliance', body: 'Advertisers remain responsible for lawful, accurate, and reviewable claims and destinations.' },
          { icon: Gavel, title: 'Enforcement', body: 'News Pulse may reject, pause, or remove material when policy, safety, legal, or quality concerns arise.' },
        ].map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-slate-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SurfacePanel className="border-slate-300/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
          <SectionHeading
            title="Disclosure and editorial trust"
            description="News Pulse requires clear separation between editorial reporting and paid or sponsored material shown on the public site."
            kicker="Core principle"
          />
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-base font-black tracking-tight text-slate-950">Disclosure standard</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Sponsored Features, Sponsored Articles, and other paid or partner-presented executions must be labeled clearly so readers can understand when content is sponsored, promoted, or presented with a brand partner.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_22px_44px_-34px_rgba(15,23,42,0.46)]">
              <ShieldAlert className="h-6 w-6 text-white/80" />
              <div className="mt-4 text-base font-black tracking-tight">Editorial distinction</div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Creative, CTA language, targeting expectations, and layout treatment should not attempt to blur the line between independent reporting and sponsored material.
              </p>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="Ad acceptance standards" description="Baseline public standards applied before advertising or sponsorship materials are accepted." kicker="Review criteria" />
          <div className="mt-6 space-y-4">
            {[
              {
                title: 'Truthfulness requirement',
                body: 'Advertising and sponsorship materials must be accurate, non-deceptive, and capable of substantiation where claims are made.',
              },
              {
                title: 'Creative standards',
                body: 'Creative must be professionally produced, readable on mobile and desktop, and free from misleading or excessively disruptive presentation.',
              },
              {
                title: 'Sponsored disclosure rules',
                body: 'Sponsored executions must carry appropriate disclosure so readers can understand when content is paid, promoted, or partner-presented.',
              },
            ].map((item, index) => (
              <div key={item.title} className="flex gap-4 rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-5">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-sm font-black text-slate-700">
                  {index + 1}
                </div>
                <div>
                  <div className="text-base font-black tracking-tight text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <SurfacePanel>
          <SectionHeading title="Restricted and prohibited categories" kicker="Eligibility" />
          <div className="mt-6 space-y-4">
            {[
              'News Pulse may reject unlawful, fraudulent, hateful, exploitative, unsafe, or otherwise harmful advertising categories outright.',
              'Sensitive sectors may require heightened compliance review, jurisdictional checks, or additional creative restrictions before acceptance.',
              'Approval on one occasion does not guarantee approval for future submissions if policy or safety conditions change.'
            ].map((text) => (
              <div key={text} className="rounded-[22px] border border-slate-200/80 bg-white p-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                <AlertTriangle className="mb-3 h-5 w-5 text-amber-700" />
                {text}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] text-white">
          <SectionHeading title="Destination URL safety" kicker="Destination review" />
          <div className="mt-6 space-y-4 text-sm leading-7 text-white/74">
            <p>
              Destination URLs must be safe, functional, reviewable, and aligned to the claims and branding used in the approved creative.
            </p>
            <p>
              News Pulse may reject or remove campaigns if landing destinations change materially, fail review, or present security, legal, or user-safety concerns.
            </p>
            <p>
              Redirect chains, misleading landing experiences, or unsafe destinations may result in non-acceptance or immediate removal.
            </p>
          </div>
        </SurfacePanel>
      </section>

      <SurfacePanel className="mt-8 overflow-hidden p-0">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="px-6 py-7 sm:px-7">
            <SectionHeading title="Compliance and enforcement" description="News Pulse retains discretion over acceptance, publication, and removal decisions when policy, safety, or legal issues arise." kicker="Enforcement" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Legal compliance',
                  body: 'Advertisers are responsible for ensuring that their materials comply with applicable laws, regulations, and disclosure requirements.',
                },
                {
                  title: 'Right to reject or remove ads',
                  body: 'News Pulse may reject, pause, or remove advertising and sponsored content at any time when policy, legal, safety, or quality concerns arise.',
                },
                {
                  title: 'Ongoing review',
                  body: 'Previously accepted material may be re-evaluated if complaints emerge, destinations change, or disclosures become insufficient.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
                  <div className="text-base font-black tracking-tight text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/85 px-6 py-7 lg:border-l lg:border-t-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Policy questions</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              If a partner, advertiser, or agency needs clarification on disclosure, safety review, or acceptance criteria, contact the News Pulse ads desk directly.
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Mail className="h-4 w-4" />
              {contactEmail}
            </a>
          </div>
        </div>
      </SurfacePanel>
    </PublicBusinessPageLayout>
  );
}