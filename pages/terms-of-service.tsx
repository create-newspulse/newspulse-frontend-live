import React from 'react';
import Link from 'next/link';
import { AlertTriangle, BadgeInfo, Copyright, FileText, Globe, Mail, Megaphone, RefreshCw, Scale, ShieldAlert } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.admin@gmail.com';

const termsSections = [
  {
    number: '1',
    title: 'Use of the Website',
    body: [
      'News Pulse provides news, information, articles, features, editorials, videos, public-interest content, and related digital services for readers.',
      'You may use the website for personal, informational, and lawful purposes. You must not use the website in a way that harms News Pulse, other users, contributors, systems, servers, or public trust.',
    ],
  },
  {
    number: '2',
    title: 'Information and News Purpose',
    body: [
      'Content published on News Pulse is for news, information, awareness, and public-interest purposes.',
      'While News Pulse aims to publish accurate and responsible content, news may develop over time. Information may be updated, corrected, clarified, or removed where required.',
      'News Pulse content should not be treated as professional legal, medical, financial, investment, or emergency advice.',
    ],
  },
  {
    number: '3',
    title: 'Prohibited Use',
    body: [
      'Users must not hack, damage, overload, disrupt, or interfere with the website or attempt unauthorised access to systems, accounts, admin areas, databases, or servers.',
      'Users must not use bots, scraping tools, spam tools, or automated systems without permission, and must not copy, republish, misuse, or commercially exploit News Pulse content without permission.',
      'Users must not submit false, defamatory, hateful, abusive, illegal, copied, misleading, or harmful content, upload material that violates copyright, privacy, or law, or misuse contact, grievance, community reporter, or journalist submission channels.',
      'News Pulse may restrict, remove, reject, or take action against misuse where necessary.',
    ],
  },
  {
    number: '4',
    title: 'User Submissions',
    body: [
      'Users may submit news tips, photos, videos, local updates, story ideas, complaints, feedback, or community reports through available channels.',
      'Submission does not guarantee publication. News Pulse may review, verify, edit, reject, hold, or remove submissions based on accuracy, legality, safety, relevance, copyright, editorial standards, and public interest.',
      'Users are responsible for ensuring that their submissions are lawful, accurate, original, and do not violate the rights of others.',
    ],
  },
  {
    number: '5',
    title: 'Content Ownership',
    body: [
      'Original content, design, logo, articles, graphics, visuals, layout, and editorial work published by News Pulse are protected by applicable intellectual property rights.',
      'Users must not copy, reproduce, modify, distribute, republish, sell, or commercially use News Pulse content without permission, except where allowed by law.',
    ],
  },
  {
    number: '6',
    title: 'Third-Party Links and Services',
    body: [
      'News Pulse may include links to third-party websites, embedded content, advertisements, social media platforms, or external services.',
      'News Pulse is not responsible for the content, accuracy, privacy practices, terms, or actions of third-party websites or services.',
    ],
  },
  {
    number: '7',
    title: 'Advertising and Sponsored Content',
    body: [
      'News Pulse may display advertisements, sponsored content, brand promotions, affiliate links, or partner content where applicable.',
      'Sponsored or promotional content should be identified where required and should not be treated as independent editorial reporting.',
    ],
  },
  {
    number: '8',
    title: 'Updates, Corrections, and Changes',
    body: [
      'News Pulse may update, correct, clarify, modify, remove, or archive website content at any time where required for accuracy, safety, legal, editorial, or technical reasons.',
      'News Pulse may also update these Terms of Service from time to time. The latest version will be available on the website.',
    ],
  },
  {
    number: '9',
    title: 'Limitation of Liability',
    body: [
      'News Pulse aims to keep the website available, secure, and accurate, but does not guarantee that the website will always be uninterrupted, error-free, fully secure, or free from technical issues.',
      'To the maximum extent permitted by law, News Pulse will not be responsible for losses arising from website downtime, technical errors, third-party links, user misuse, reliance on information, or unauthorised activities beyond reasonable control.',
    ],
  },
  {
    number: '10',
    title: 'Contact',
    body: [
      'For questions related to these Terms of Service, users may contact News Pulse through the public contact page.',
      'Website: www.newspulse.co.in',
      `Contact: ${contactEmail}`,
    ],
  },
] as const;

const summaryCards = [
  {
    title: 'Responsible Use',
    text: 'Use the website lawfully and in ways that do not harm News Pulse, its systems, contributors, readers, or public trust.',
    Icon: Scale,
  },
  {
    title: 'Reader Clarity',
    text: 'These terms explain how readers, contributors, and visitors may use the News Pulse website responsibly.',
    Icon: FileText,
  },
  {
    title: 'Public Contact',
    text: 'Questions about these terms can be directed through the public contact route or the listed contact email.',
    Icon: Mail,
  },
] as const;

const sectionIcons = [BadgeInfo, Globe, ShieldAlert, AlertTriangle, Copyright, Globe, Megaphone, RefreshCw, Scale, Mail] as const;

export default function TermsOfServicePage() {
  return (
    <PublicBusinessPageLayout
      title="Terms of Service"
      description="Please read these terms before using News Pulse. These terms explain how readers, contributors, and visitors may use the News Pulse website responsibly."
      contactEmail={contactEmail}
      contactHref="/contact"
      contactAriaLabel="Contact News Pulse about terms"
      contactTitle="Contact News Pulse about terms"
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Public website terms</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Terms of Service
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">Please read these terms before using News Pulse.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Welcome to News Pulse. By accessing or using www.newspulse.co.in, you agree to use the website responsibly and in accordance with these Terms of Service.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
            <div className="rounded-full border border-slate-200/80 bg-slate-50 px-4 py-2">Last Updated: 18 June 2026</div>
            <a href="https://www.newspulse.co.in" className="rounded-full border border-slate-200/80 bg-slate-50 px-4 py-2 underline">
              Website: www.newspulse.co.in
            </a>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Terms summary</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Basic responsibilities for using News Pulse</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            These terms explain how readers, contributors, and visitors may use the News Pulse website responsibly.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Use the website for personal, informational, and lawful purposes.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Do not misuse systems, copy content without permission, or abuse public submission channels.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Content may be updated, corrected, clarified, removed, or changed where required.</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
              Contact News Pulse
            </Link>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {summaryCards.map(({ title, text, Icon }) => (
          <SurfacePanel key={title} className="min-w-0">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        {termsSections.map((section, index) => {
          const Icon = sectionIcons[index];
          const isContactSection = section.title === 'Contact';

          return (
            <SurfacePanel key={section.number} className="min-w-0">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Section {section.number}</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{section.title}</h2>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                {section.body.map((paragraph) => {
                  if (paragraph === 'Website: www.newspulse.co.in') {
                    return (
                      <p key={paragraph}>
                        Website:{' '}
                        <a href="https://www.newspulse.co.in" className="font-semibold text-sky-700 underline">
                          www.newspulse.co.in
                        </a>
                      </p>
                    );
                  }

                  if (paragraph === `Contact: ${contactEmail}`) {
                    return (
                      <p key={paragraph}>
                        Contact:{' '}
                        <a href={`mailto:${contactEmail}`} className="font-semibold text-sky-700 underline">
                          {contactEmail}
                        </a>
                      </p>
                    );
                  }

                  return <p key={paragraph}>{paragraph}</p>;
                })}
              </div>

              {isContactSection ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Open Contact Page
                  </Link>
                </div>
              ) : null}
            </SurfacePanel>
          );
        })}
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <SectionHeading
            title="Contact"
            kicker="Questions about these terms"
            description="For questions related to these Terms of Service, users may contact News Pulse through the public contact page."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-sm font-semibold text-slate-800">Website</div>
              <a href="https://www.newspulse.co.in" className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline">
                www.newspulse.co.in
              </a>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-sm font-semibold text-slate-800">Contact</div>
              <a href={`mailto:${contactEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
                {contactEmail}
              </a>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}