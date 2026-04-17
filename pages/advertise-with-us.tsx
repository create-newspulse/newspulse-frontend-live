import React from 'react';
import { ArrowRight, Briefcase, Globe2, Handshake, Layers3, Mail, Megaphone } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'newspulse.ads@gmail.com';

export default function AdvertiseWithUsPage() {
  return (
    <PublicBusinessPageLayout
      title="Advertise With Us"
      description="News Pulse offers advertising and sponsorship opportunities across homepage, article, ticker, and sponsored-content environments for brands seeking trusted, multilingual public reach."
      contactEmail={contactEmail}
      tone="amber"
    >
      <SurfacePanel className="relative overflow-hidden p-8 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.10),transparent_28%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
          <div className="max-w-3xl">
            <PageEyebrow tone="amber">Advertising and sponsorship</PageEyebrow>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.35rem] sm:leading-[1.02]">
              Bring your brand into News Pulse with placements built for reach, credibility, and momentum.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-[17px]">
              This page is the public starting point for advertisers, sponsors, and brand teams exploring how News Pulse can support launches, awareness campaigns, and premium partner storytelling across English, Hindi, and Gujarati audiences.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent('Advertising enquiry')}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start an enquiry
                <ArrowRight className="h-4 w-4" />
              </a>
              <ContactPill email={contactEmail} label="Email the ads desk" />
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.38)] backdrop-blur">
            {[
              { label: 'Audience reach', value: 'Public news, category, and article environments designed for broad campaign visibility.' },
              { label: 'Sponsorship paths', value: 'Display, ticker, and branded-storytelling options that can work together in one campaign.' },
              { label: 'Starting point', value: 'Use this page to begin the conversation, then align with the ads desk on fit and next steps.' },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-amber-100 bg-white/85 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">{item.label}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </SurfacePanel>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[
          {
            icon: Globe2,
            title: 'Why advertise with News Pulse',
            body: 'Appear in trusted public reading environments where readers actively browse headlines, follow live updates, and open stories.',
          },
          {
            icon: Briefcase,
            title: 'Commercial flexibility',
            body: 'Campaigns can focus on launch visibility, steady brand presence, or sponsorship moments without changing the site experience.',
          },
          {
            icon: Layers3,
            title: 'Multiformat planning',
            body: 'Pair homepage exposure with article placements, ticker support, or sponsored storytelling depending on campaign goals.',
          },
          {
            icon: Handshake,
            title: 'Clear next step',
            body: 'The page is built to move quickly from public overview into an enquiry with the ads desk instead of acting like a rate card.',
          },
        ].map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-amber-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Opportunity</div>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Advertising opportunities</h2>
          <p className="mt-4 text-sm leading-7 text-white/72">
            News Pulse supports premium public-facing placements that suit both broad brand visibility and more contextual campaign journeys.
          </p>

          <div className="mt-6 space-y-3">
            {[
              'Homepage and section placements for broad visibility during discovery-led sessions.',
              'Article and reading-flow placements for campaigns that benefit from contextual attention.',
              'Ticker sponsorships for brands seeking association with fast-moving update environments.',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/74">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <div className="grid gap-4">
          {[
            {
              title: 'High-visibility reach',
              body: 'Use top-level homepage, section, and premium display placements when the priority is first-look visibility and broad campaign recall.',
            },
            {
              title: 'Contextual reading presence',
              body: 'Article and related reading environments offer brand presence closer to moments where audiences are already engaged with content.',
            },
            {
              title: 'Sponsorship-led presence',
              body: 'Breaking surfaces, recurring update areas, and branded content journeys can support campaigns that need stronger association or storytelling depth.',
            },
          ].map((item, index) => (
            <SurfacePanel key={item.title} className="p-6">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-800">
                  0{index + 1}
                </div>
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-950">{item.title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              </div>
            </SurfacePanel>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SurfacePanel>
          <SectionHeading
            kicker="Sponsored content"
            title="Sponsored content options"
            description="Use branded storytelling when the campaign needs more room for message clarity, context, or a deeper brand narrative than standard display can provide."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Sponsored Feature',
                body: 'A homepage-led promotional card designed to introduce the brand clearly and route readers into a deeper destination.',
              },
              {
                title: 'Sponsored Article',
                body: 'A full public article experience for longer brand storytelling with disclosure, supporting context, and optional CTA.',
              },
              {
                title: 'Feature to article path',
                body: 'A connected campaign route where first-look discovery leads directly into a more detailed sponsored reading experience.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
                <Megaphone className="h-5 w-5 text-amber-700" />
                <div className="mt-3 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8eb_0%,#ffffff_100%)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%)]" />
          <div className="relative">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Enquiry path</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">How to start an enquiry</div>
            <div className="mt-6 space-y-4">
              {[
                'Share the campaign goal, launch moment, or sponsorship objective you are trying to support.',
                'Mention the format types that seem most relevant, such as homepage, article, ticker, or sponsored content.',
                'Send the note to the ads desk so the discussion can move into fit, availability, and campaign planning.',
              ].map((step, index) => (
                <div key={step} className="flex gap-4 rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-4">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-800">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </SurfacePanel>
      </section>

      <SurfacePanel className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact the ads desk</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Ready to explore a sponsorship or advertising opportunity?</div>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Pricing is handled privately after initial qualification. Use the enquiry path above to start the conversation with News Pulse.
          </p>
        </div>

        <a
          href={`mailto:${contactEmail}?subject=${encodeURIComponent('Advertising enquiry')}`}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          <Mail className="h-4 w-4" />
          {contactEmail}
        </a>
      </SurfacePanel>
    </PublicBusinessPageLayout>
  );
}