import React from 'react';
import { CalendarRange, Languages, LayoutPanelTop, Mail, MonitorSmartphone, PanelRight, Radio, Sparkles } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.ads@gmail.com';

export default function MediaKitPage() {
  return (
    <PublicBusinessPageLayout
      title="Media Kit"
      description="This public media kit is a formats guide for News Pulse advertising and sponsorship inventory. It is intentionally formats-only and does not publish pricing or rate cards."
      contactEmail={contactEmail}
      tone="sky"
    >
      <SurfacePanel className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="p-8 sm:p-10">
            <PageEyebrow tone="sky">Public formats guide</PageEyebrow>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.2rem] sm:leading-[1.03]">
              Use the News Pulse media kit to map placements, formats, and creative needs.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
              This page is a public planning reference for display, article, ticker, and sponsored-content formats on News Pulse. It is deliberately inventory-focused, with no pricing, rate cards, or policy review content.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                'Display formats',
                'Article placements',
                'Ticker sponsors',
                'Sponsored content formats',
                'Supported languages',
                'Creative guidance',
              ].map((item) => (
                <div key={item} className="rounded-[20px] border border-sky-100 bg-sky-50/65 px-4 py-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#eff6ff_100%)] p-7 lg:border-l lg:border-t-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-800">Planning note</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Formats overview only</div>
            <div className="mt-5 space-y-3">
              {[
                'Placement descriptions are public-facing and intended to support creative planning.',
                'Pricing and booking terms are handled directly with the ads desk.',
                'Use this page alongside campaign goals to decide which format mix to discuss next.',
              ].map((item) => (
                <div key={item} className="rounded-[20px] border border-white/90 bg-white/85 p-4 text-sm leading-7 text-slate-600 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.28)]">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <ContactPill email={contactEmail} label="Request booking guidance" />
            </div>
          </div>
        </div>
      </SurfacePanel>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <SurfacePanel>
          <SectionHeading title="Display formats" description="Core display inventory available across the public reading experience." kicker="Inventory" />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              { title: 'Homepage banner formats', body: 'Standard homepage banner inventory for repeat visibility near top-level public navigation and news discovery.', icon: LayoutPanelTop },
              { title: 'Right rail formats', body: 'Sidebar units suited to browsing and article contexts where readers are already in active consumption mode.', icon: PanelRight },
              { title: 'Billboard', body: 'Large-format billboard inventory intended for premium homepage presence and strong campaign impact.', icon: CalendarRange },
            ].map((item) => (
              <div key={item.title} className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5">
                <item.icon className="h-6 w-6 text-sky-700" />
                <div className="mt-4 text-base font-black tracking-tight text-slate-950">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Format planning</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Use format mix, not one placement in isolation.</div>
          <p className="mt-4 text-sm leading-7 text-white/72">
            Strong public campaigns often combine high-visibility display placements with reading-flow formats or sponsored storytelling, depending on the message depth required.
          </p>
          <div className="mt-6 space-y-3">
            {[
              'Display formats support broad awareness and top-level visibility.',
              'Article placements work best when the campaign benefits from contextual attention.',
              'Sponsored content formats add room for explanation, narrative, and CTA-led journeys.',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/74">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <SurfacePanel>
          <SectionHeading title="Article placements" description="Formats used inside or around article reading sessions." kicker="Reading environments" />
          <div className="mt-6 grid gap-4">
            {[
              'Inline article placements can appear within the reading flow where a public ad unit is appropriate.',
              'Article-end placements support campaigns that benefit from appearing after the reader finishes the story.',
              'Article environments are best suited to clear, legible creative that respects reading continuity.',
            ].map((text) => (
              <div key={text} className="rounded-[22px] border border-slate-200/80 bg-white p-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {text}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] text-white">
          <SectionHeading
            title="Ticker sponsors"
            description="Brand association inventory used around breaking and live update ticker experiences."
            kicker="Live surfaces"
          />
          <div className="mt-6 space-y-4">
            {[
              'Ticker sponsors are best suited to concise branding and message clarity rather than dense copy.',
              'These placements align with breaking and live-update environments where speed and readability matter most.',
              'Creative should remain light, direct, and consistent with fast-moving update surfaces.',
            ].map((text) => (
              <div key={text} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/75">
                <Radio className="mb-3 h-5 w-5 text-sky-300" />
                {text}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <SurfacePanel className="overflow-hidden p-0">
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <SectionHeading title="Sponsored content formats" description="Public brand-storytelling formats available on the frontend." kicker="Sponsored inventory" />
          </div>
          <div className="grid gap-0 divide-y divide-slate-200/80">
            {[
              { title: 'Sponsored Feature', body: 'A homepage promo card with clear labeling, image-led presentation, summary, and CTA.' },
              { title: 'Sponsored Article', body: 'A public article page with trust labeling, sponsor disclosure, and optional CTA for longer-form brand storytelling.' },
              { title: 'Combo campaign', body: 'A connected path where a Sponsored Feature routes readers directly into a Sponsored Article.' },
            ].map((item) => (
              <div key={item.title} className="px-6 py-5 sm:px-7">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-black tracking-tight text-slate-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <div className="grid gap-5">
          <SurfacePanel>
            <SectionHeading title="Supported languages" kicker="Localization" />
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {['English', 'Hindi', 'Gujarati'].map((language) => (
                <div key={language} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm font-semibold text-slate-700">
                  <Languages className="h-4 w-4 text-sky-700" />
                  {language}
                </div>
              ))}
            </div>
          </SurfacePanel>

          <SurfacePanel>
            <SectionHeading title="Creative guidance" description="Public guidance for planning creative before booking review." kicker="Planning" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                'Use high-quality imagery, clean branding, and concise copy that remains legible across desktop and mobile placements.',
                'Ensure the destination URL matches the creative promise and is safe, functional, and reviewable.',
                'Plan localized creative early if the campaign needs English, Hindi, or Gujarati execution.',
                'Keep messaging appropriate to the selected format: ticker sponsors should remain concise, while sponsored content can carry more context.',
              ].map((text, index) => (
                <div key={text} className="rounded-[22px] border border-slate-200/80 bg-white p-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <MonitorSmartphone className="h-4 w-4" />
                    Guidance {index + 1}
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </SurfacePanel>
        </div>
      </section>

      <SurfacePanel className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Booking contact</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Need availability or specification guidance?</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">Contact the ads desk for booking guidance, material specs, and scheduling support. This page remains public formats-only with no pricing.</p>
        </div>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800"
        >
          <Mail className="h-4 w-4" />
          {contactEmail}
        </a>
      </SurfacePanel>
    </PublicBusinessPageLayout>
  );
}
