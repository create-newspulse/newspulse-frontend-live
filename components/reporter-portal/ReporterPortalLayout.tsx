import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { getReporterDisplayName, type ReporterPortalProfile, type ReporterPortalSession } from '../../lib/reporterPortal';

type PortalSection = 'dashboard' | 'submissions' | 'submit' | 'profile' | 'login';

type Props = {
  title: string;
  description: string;
  active: PortalSection;
  session?: ReporterPortalSession | null;
  profile?: ReporterPortalProfile | null;
  onLogout?: () => void;
  children: React.ReactNode;
};

const NAV_ITEMS: Array<{ key: Exclude<PortalSection, 'login'>; href: string; label: string }> = [
  { key: 'dashboard', href: '/reporter/dashboard', label: 'Dashboard' },
  { key: 'submissions', href: '/reporter/submissions', label: 'Submissions' },
  { key: 'submit', href: '/reporter/submit', label: 'Submit Story' },
  { key: 'profile', href: '/reporter/profile', label: 'Profile' },
];

const navItemClass = (active: boolean) => (
  active
    ? 'rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white'
    : 'rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50'
);

export default function ReporterPortalLayout({ title, description, active, session, profile, onLogout, children }: Props) {
  const displayName = getReporterDisplayName({
    fullName: profile?.fullName || session?.fullName,
    name: profile?.name || session?.name,
    firstName: profile?.firstName || session?.firstName,
    email: profile?.email || session?.email,
  });
  const displayEmail = profile?.email || session?.email || 'Not signed in';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <title>{`${title} | News Pulse Reporter Portal`}</title>
        <meta name="description" content={description} />
      </Head>

      <section className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                Reporter Portal
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Signed in reporter</div>
              <div>{displayName}</div>
              <div className="text-xs text-slate-500">{displayEmail}</div>
              <div className="mt-3 flex items-center gap-2">
                <Link href="/community-reporter" className="text-xs font-semibold text-blue-700 hover:underline">
                  Public Community Reporter page
                </Link>
                {onLogout ? (
                  <button type="button" onClick={onLogout} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    Log out
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {active !== 'login' ? (
            <nav className="mt-6 flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => (
                <Link key={item.key} href={item.href} className={navItemClass(item.key === active)}>
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}