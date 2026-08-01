import Link from 'next/link';
import React from 'react';
import { BarChart3, Cookie, Megaphone, Settings, ShieldCheck, Video } from 'lucide-react';

import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';
import { useCookieConsent } from '../src/consent/CookieConsentProvider';
import {
  COOKIE_CONSENT_VERSION,
  COOKIE_POLICY_CONTACT_EMAIL,
  COOKIE_POLICY_EFFECTIVE_DATE,
  COOKIE_POLICY_LAST_UPDATED,
  getCookiePolicyCopy,
  getCookiePolicyInventory,
} from '../src/consent/cookiePolicyContent';
import { useI18n } from '../src/i18n/LanguageProvider';

const iconByCategory = {
  necessary: ShieldCheck,
  preferences: Settings,
  analytics: BarChart3,
  advertising: Megaphone,
  embeddedMedia: Video,
} as const;

export default function CookiePolicyPage() {
  const { lang } = useI18n();
  const { openPreferences } = useCookieConsent();
  const copy = getCookiePolicyCopy(lang);
  const inventory = getCookiePolicyInventory();

  return (
    <PublicBusinessPageLayout
      title={copy.metaTitle}
      description={copy.metaDescription}
      contactEmail={COOKIE_POLICY_CONTACT_EMAIL}
      contactHref={`mailto:${COOKIE_POLICY_CONTACT_EMAIL}`}
      contactAriaLabel="Email News Pulse about cookies and privacy"
      contactTitle="Email News Pulse about cookies and privacy"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">{copy.eyebrow}</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">{copy.intro}</p>
          <div className="mt-5 grid gap-1 text-sm font-semibold text-slate-700">
            <div>{copy.effectiveDateLabel}: {COOKIE_POLICY_EFFECTIVE_DATE}</div>
            <div>{copy.lastUpdatedLabel}: {COOKIE_POLICY_LAST_UPDATED}</div>
            <div>{copy.versionLabel}: {COOKIE_CONSENT_VERSION}</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/privacy-policy" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {copy.privacyPolicyLink}
            </Link>
            <Link href="/privacy-request" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {copy.privacyRequestLink}
            </Link>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">{copy.controlCardKicker}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{copy.controlCardTitle}</div>
          <p className="mt-5 text-sm leading-7 text-white/72">{copy.controlCardText}</p>
          <button
            type="button"
            onClick={openPreferences}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {copy.openSettings}
          </button>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {copy.cards.map(({ title, body, category }) => {
          const Icon = iconByCategory[category];
          return (
            <SurfacePanel key={title} className="min-w-0 p-5">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
            </SurfacePanel>
          );
        })}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        {copy.sections.map((section) => (
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

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden">
          <SectionHeading title={copy.inventoryTitle} description={copy.inventoryIntro} />
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">{copy.table.name}</th>
                  <th className="px-4 py-3 font-black">{copy.table.provider}</th>
                  <th className="px-4 py-3 font-black">{copy.table.category}</th>
                  <th className="px-4 py-3 font-black">{copy.table.purpose}</th>
                  <th className="px-4 py-3 font-black">{copy.table.duration}</th>
                  <th className="px-4 py-3 font-black">{copy.table.currentStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {inventory.map((item) => (
                  <tr key={`${item.name}-${item.sourceFile}`} className="align-top">
                    <td className="px-4 py-4 font-black text-slate-950">{item.name}</td>
                    <td className="px-4 py-4">{item.provider}</td>
                    <td className="px-4 py-4">{copy.categoryLabels[item.category]}</td>
                    <td className="px-4 py-4 leading-6">{item.purpose}</td>
                    <td className="px-4 py-4 leading-6">{item.duration}</td>
                    <td className="px-4 py-4 font-semibold">{copy.statusLabels[item.currentStatus] || item.currentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}