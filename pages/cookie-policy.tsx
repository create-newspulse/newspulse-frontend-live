import Link from 'next/link';
import React from 'react';
import { BarChart3, Cookie, Megaphone, Settings, ShieldCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'privacy@newspulse.co.in';

const cookieCards = [
  {
    title: 'Essential Cookies',
    body: 'Essential cookies may be used for basic site operation, security, page delivery, session continuity, and features that are necessary for News Pulse to work properly.',
    Icon: ShieldCheck,
  },
  {
    title: 'Analytics Cookies',
    body: 'Analytics cookies may help News Pulse understand aggregate usage patterns, page performance, reader engagement, and technical issues so the website can be improved.',
    Icon: BarChart3,
  },
  {
    title: 'Advertising Cookies',
    body: 'Advertising cookies may support ad delivery, campaign measurement, frequency controls, sponsored placements, and related advertising features where enabled.',
    Icon: Megaphone,
  },
  {
    title: 'Preference Cookies',
    body: 'Preference cookies may remember choices such as language, display preferences, or other settings that make the News Pulse experience easier to use.',
    Icon: Settings,
  },
] as const;

const policySections = [
  {
    title: '1. How News Pulse Uses Cookies',
    body: [
      'News Pulse may use cookies and similar technologies to operate the website, protect users, measure site performance, support advertising features, and remember user preferences where enabled.',
      'Cookies are small files or browser-based identifiers stored on a device by a website or related service. They can be temporary for a session or remain for a longer period depending on their purpose.',
    ],
  },
  {
    title: '2. Essential Cookies',
    body: [
      'Essential cookies are used for necessary website functions such as security, basic navigation, page loading, form protection, and service reliability.',
      'Because these cookies are required for the website to work properly, they may remain active even when users reject non-essential cookies.',
    ],
  },
  {
    title: '3. Analytics Cookies',
    body: [
      'Analytics cookies may help News Pulse understand how readers use the website, which pages are visited, how content performs, and whether technical improvements are needed.',
      'Analytics information should be used in an aggregate or limited manner to improve website performance and reader experience.',
    ],
  },
  {
    title: '4. Advertising Cookies',
    body: [
      'Advertising cookies may be used to support ad delivery, sponsored placements, campaign reporting, frequency management, and measurement of advertising performance where advertising tools are enabled.',
      'Advertising partners or third-party services may also use cookies according to their own policies when their services are active on the website.',
    ],
  },
  {
    title: '5. Preference Cookies',
    body: [
      'Preference cookies may remember choices such as selected language, display options, region preferences, or other settings chosen by users.',
      'These cookies help reduce repeated setup steps and make the website easier to use across visits.',
    ],
  },
  {
    title: '6. User Choice',
    body: [
      'Users can accept or reject non-essential cookies where cookie controls are available. Users may also manage or block cookies through their browser settings.',
      'A future News Pulse cookie banner will respect user choice for non-essential cookies. Essential cookies needed for website operation may continue to be used.',
    ],
  },
  {
    title: '7. Contact',
    body: [
      `For cookie or privacy questions, users may contact News Pulse at ${contactEmail}.`,
      'This is the official privacy and DPDP contact email for News Pulse.',
    ],
  },
] as const;

export default function CookiePolicyPage() {
  return (
    <PublicBusinessPageLayout
      title="Cookie Policy"
      description="The News Pulse cookie policy explains essential, analytics, advertising, and preference cookies, and how users can manage non-essential cookie choices."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Email News Pulse about cookies and privacy"
      contactTitle="Email News Pulse about cookies and privacy"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Cookie and consent information</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Cookie Policy
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse may use cookies and similar technologies for essential site operation, analytics, advertising support, and user preferences. This page explains the main cookie categories and how non-essential cookie choices will be handled.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/privacy-policy" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Privacy Policy
            </Link>
            <Link href="/dpdp-privacy-rights" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              DPDP / Privacy Rights
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">User choice</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Non-essential cookies can be accepted or rejected.</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            A future cookie banner will respect user choices for non-essential cookies. This Release 1A page is informational only and does not add a cookie banner.
          </p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cookieCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        {policySections.map((section) => (
          <SurfacePanel key={section.title} className="min-w-0">
            <SectionHeading title={section.title} />
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </SurfacePanel>
        ))}
      </section>
    </PublicBusinessPageLayout>
  );
}