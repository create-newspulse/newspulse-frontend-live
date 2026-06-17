import Link from 'next/link';
import React from 'react';
import { CheckCircle2, Scale, SearchCheck, ShieldCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'Newspulse.team@gmail.com';

const trustCards = [
  {
    title: 'Accuracy',
    body: 'We aim to verify facts carefully and publish information with context and clarity.',
    Icon: ShieldCheck,
  },
  {
    title: 'Fairness',
    body: 'We try to present reports in a balanced way and avoid careless or distorted framing.',
    Icon: Scale,
  },
  {
    title: 'Transparency',
    body: 'Where information is still developing, we aim to say so clearly and responsibly.',
    Icon: SearchCheck,
  },
  {
    title: 'Corrections',
    body: 'If a factual issue is identified, content may be corrected, updated, clarified, or removed.',
    Icon: CheckCircle2,
  },
] as const;

const policySections = [
  {
    title: '1. Editorial Independence',
    body: [
      'News Pulse maintains editorial independence in its news selection, reporting, writing, editing, and publishing process. Editorial decisions are made in the interest of public information, accuracy, relevance, fairness, and social responsibility.',
      'Advertising, sponsorship, partnerships, or commercial interests must not improperly influence editorial judgment.',
    ],
  },
  {
    title: '2. Source Verification',
    body: [
      'News Pulse gives preference to reliable and accountable sources, including official statements, government notices, public documents, court records, police updates, verified agencies, credible media references, field reports, and direct confirmations.',
      'Where information is developing or not fully confirmed, we aim to clearly state that the matter is developing or based on information available at the time of publication.',
    ],
  },
  {
    title: '3. Accuracy and Corrections',
    body: [
      'News Pulse aims to publish accurate, balanced, and properly contextual information. If a factual error is identified after publication, we may correct, update, clarify, or remove the affected content where necessary.',
      'Significant corrections may be noted in the article or updated page where appropriate.',
    ],
  },
  {
    title: '4. Right of Reply',
    body: [
      'Where a report includes serious allegations, claims, or criticism involving a person, organisation, business, institution, public figure, or authority, News Pulse aims to make reasonable efforts to include their response or version of events.',
      'If a response is received after publication, the story may be updated with the relevant response.',
    ],
  },
  {
    title: '5. Crime and Sensitive Reporting',
    body: [
      'News Pulse follows extra caution while reporting crime, investigations, arrests, court matters, sexual offences, minors, domestic violence, suicide, communal tension, caste or religious conflict, and other sensitive matters.',
      'We avoid declaring any person guilty before a final legal finding by a competent authority. Reports should use careful language such as “according to police,” “as per the complaint,” or “the matter is under investigation” where applicable.',
    ],
  },
  {
    title: '6. Sponsored Content Disclosure',
    body: [
      'Advertisements, sponsored articles, brand promotions, paid collaborations, or partner content must be clearly identified wherever applicable.',
      'Sponsored or promotional content should not be presented as independent editorial reporting.',
    ],
  },
  {
    title: '7. No Plagiarism or Misleading Content',
    body: [
      'News Pulse does not support plagiarism, fabricated reporting, misleading headlines, unrelated images, manipulated visuals, or content copied without permission, lawful basis, or proper attribution where applicable.',
      'Our goal is to publish original, responsible, and reader-focused content.',
    ],
  },
  {
    title: '8. Final Editorial Responsibility',
    body: [
      'All content published by News Pulse is subject to editorial judgment and review. News Pulse may edit, update, reject, hold, correct, or remove content if it is found to be inaccurate, unsafe, copied, defamatory, misleading, unlawful, or against our editorial standards.',
    ],
  },
  {
    title: '9. Contact',
    body: [
      'For editorial concerns, corrections, or content-related feedback, readers may contact News Pulse through the public contact or grievance redressal channels available on the website.',
    ],
  },
] as const;

export default function EditorialPolicyPage() {
  return (
    <PublicBusinessPageLayout
      title="Editorial Policy"
      description="The News Pulse editorial policy explains core publishing principles, corrections, and advertising separation."
      contactEmail={contactEmail}
      contactHref="/contact"
      contactAriaLabel="Contact News Pulse"
      contactTitle="Contact News Pulse"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Newsroom standards</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Editorial Policy
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">Independent. Accurate. Fair. Responsible.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse is committed to publishing news and information with accuracy, fairness, transparency, and public responsibility. Our editorial policy explains how we select, verify, write, review, correct, and publish content on our platform.
          </p>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Editorial values</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Public-facing editorial standards</div>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Accuracy, fairness, transparency, and public responsibility remain central to editorial decisions.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Verification, context, and careful language matter especially in sensitive or developing stories.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Advertising and sponsored material should be kept distinct from independent editorial reporting.</div>
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

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {policySections.map((section) => (
          <SurfacePanel key={section.title} className="min-w-0">
            <SectionHeading title={section.title} />
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {section.title === '9. Contact' ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Contact Us
                </Link>
                <Link href="/grievance-redressal" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Grievance Redressal
                </Link>
              </div>
            ) : null}
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Editorial Contact" kicker="Reader feedback" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                For editorial concerns, correction requests, or content-related feedback, readers can use the public contact and grievance channels available on the website.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.26)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact</div>
              <div className="mt-3 text-lg font-black tracking-tight text-slate-950">News Pulse</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">Public editorial feedback, corrections, and related concerns can be directed through the published contact routes.</p>
              <div className="mt-4 text-sm font-semibold text-slate-700">Email: {contactEmail}</div>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}