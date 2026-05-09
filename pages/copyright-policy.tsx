import React from 'react';
import { AlertTriangle, CopyCheck, Gavel, Mail, Shield, ShieldAlert } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'Newspulse.team@gmail.com';
const contactHref = '/contact?type=copyright';
const contactLabel = 'Contact News Pulse team';

export default function CopyrightPolicyPage() {
  return (
    <PublicBusinessPageLayout
      title="Copyright Policy"
      description="The News Pulse copyright policy explains how original News Pulse content is protected and how to request permission or report unauthorized copying."
      contactEmail={contactEmail}
      contactHref={contactHref}
      contactAriaLabel={contactLabel}
      contactTitle={contactLabel}
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <SurfacePanel className="sm:p-10">
          <PageEyebrow tone="slate">Rights, permissions, and anti-copying policy</PageEyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Copyright Policy
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            © 2025–2026 News Pulse Media. All Rights Reserved.
          </p>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            All original content published on News Pulse, including articles, headlines, summaries, photographs, videos, graphics, website design, layout, code, and database structure, is protected by applicable copyright laws.
          </p>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Policy focus</div>
          <div className="mt-2 text-2xl font-black tracking-tight">What this page covers</div>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Content ownership and copyright scope</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Allowed sharing versus prohibited copying or scraping</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Permission requests, reporting, and enforcement</div>
          </div>
          <div className="mt-6">
            <ContactPill
              email={contactEmail}
              label="Contact for permissions or complaints"
              href={contactHref}
              ariaLabel={contactLabel}
              title={contactLabel}
            />
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[
          { icon: Shield, title: 'Protected Content', body: 'Articles, headlines, summaries, visuals, code, layout, and database structure created by News Pulse are protected by applicable copyright laws.' },
          { icon: CopyCheck, title: 'Sharing Rule', body: 'Users may share original News Pulse links for informational purposes, as long as the News Pulse source link remains clear and the content is not copied or misrepresented.' },
          { icon: ShieldAlert, title: 'Prohibited Use', body: 'No person, website, app, AI tool, bot, scraper, or third party may copy, republish, translate, scrape, store, or commercially use News Pulse content without prior written permission.' },
          { icon: Gavel, title: 'Enforcement', body: 'News Pulse Media may take legal, technical, search engine, hosting, and platform-level action against unauthorized copying, impersonation, or misuse.' },
        ].map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-slate-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SurfacePanel className="border-slate-300/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
          <SectionHeading
            title="What cannot be copied"
            description="News Pulse protects the original expression and presentation it creates, not the underlying public facts themselves."
            kicker="Protected material"
          />
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-base font-black tracking-tight text-slate-950">Protected original work</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                If anyone wants licensing permission or wants to report unauthorized copying, they can contact Newspulse.team@gmail.com.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                No person, website, app, publication, AI tool, bot, scraper, or third party may copy, reproduce, republish, modify, translate, distribute, store, scrape, or commercially use News Pulse content without prior written permission from News Pulse Media.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_22px_44px_-34px_rgba(15,23,42,0.46)]">
              <AlertTriangle className="h-6 w-6 text-white/80" />
              <div className="mt-4 text-base font-black tracking-tight">No copying of original presentation</div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                News facts and public information may be independently reported by others, but the original writing, presentation, headline style, summaries, images, graphics, videos, code, design, and arrangement created by News Pulse must not be copied.
              </p>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="Allowed sharing and linking" description="Readers may share News Pulse links, but not republish the protected content itself." kicker="Permitted use" />
          <div className="mt-6 space-y-4">
            {[
              {
                key: 'sharing-links',
                content: (
                  <>Users may share News Pulse article links on social media or messaging platforms for informational purposes, provided the original News Pulse link is clearly included and the content is not copied or misrepresented.</>
                ),
              },
              {
                key: 'sharing-copying',
                content: (
                  <>Sharing a link to the original News Pulse article is allowed; copying the full headline package, summary, media, or page structure is not allowed without written permission.</>
                ),
              },
              {
                key: 'sharing-contact',
                content: (
                  <>If anyone wants licensing permission or wants to report unauthorized copying, they can contact Newspulse.team@gmail.com.</>
                ),
              },
            ].map((item, index) => (
              <div key={item.key} className="flex gap-4 rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-5">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-sm font-black text-slate-700">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm leading-7 text-slate-600">{item.content}</p>
                </div>
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <SurfacePanel className="mt-8 overflow-hidden p-0">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="px-6 py-7 sm:px-7">
            <SectionHeading title="Enforcement and reporting" description="News Pulse Media reserves the right to take legal and platform-level action where unauthorized copying or scraping occurs." kicker="Action" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Legal action',
                  body: 'News Pulse Media reserves the right to take legal action against unauthorized copying, republication, impersonation, or misuse of its content.',
                },
                {
                  title: 'Technical and platform action',
                  body: 'News Pulse Media may pursue search engine, hosting, and platform-level enforcement where scraping, copying, or misuse is detected.',
                },
                {
                  title: 'Permission and complaints',
                  body: 'For licensing permission or to report unauthorized copying, contact the News Pulse team directly at the address listed on this page.',
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
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              If anyone wants licensing permission or wants to report unauthorized copying, they can contact:
            </p>
            <a
              href={contactHref}
              aria-label={contactLabel}
              title={contactLabel}
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