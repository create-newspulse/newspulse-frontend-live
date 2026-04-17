import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';

type PublicBusinessPageLayoutProps = {
  title: string;
  description: string;
  contactEmail: string;
  tone?: 'sky' | 'amber' | 'slate';
  children: React.ReactNode;
};

const toneClasses = {
  sky: {
    backdrop:
      'bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#f7f8fc_0%,#eef4ff_42%,#f7f7fb_100%)]',
    glow: 'bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.10),transparent_58%)]',
  },
  amber: {
    backdrop:
      'bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#fbf7ef_0%,#fff7ed_40%,#faf8f3_100%)]',
    glow: 'bg-[radial-gradient(circle_at_50%_0%,rgba(120,53,15,0.10),transparent_58%)]',
  },
  slate: {
    backdrop:
      'bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.10),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(51,65,85,0.10),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_42%,#f8fafc_100%)]',
    glow: 'bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.12),transparent_58%)]',
  },
} as const;

export default function PublicBusinessPageLayout({ title, description, contactEmail, tone = 'sky', children }: PublicBusinessPageLayoutProps) {
  const palette = toneClasses[tone];

  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
        <meta name="description" content={description} />
      </Head>

      <main className="min-h-screen bg-[#f4f6fb] text-slate-900">
        <div className="relative overflow-hidden">
          <div className={`pointer-events-none absolute inset-0 -z-10 ${palette.backdrop}`} />
          <div className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] ${palette.glow}`} />

          <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-24 lg:pt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to News Pulse
              </Link>

              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <Mail className="h-4 w-4" />
                {contactEmail}
              </a>
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
    </>
  );
}

export function PageEyebrow({ children, tone = 'sky' }: { children: React.ReactNode; tone?: 'sky' | 'amber' | 'slate' }) {
  const classes =
    tone === 'amber'
      ? 'border-amber-200/80 bg-amber-50 text-amber-800'
      : tone === 'slate'
        ? 'border-slate-200/80 bg-slate-100 text-slate-700'
        : 'border-sky-200/70 bg-sky-50/90 text-sky-800';

  return <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${classes}`}>{children}</div>;
}

export function SurfacePanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[32px] border border-slate-200/75 bg-white/84 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.30)] backdrop-blur sm:p-7 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ title, description, kicker }: { title: string; description?: string; kicker?: string }) {
  return (
    <div className="max-w-3xl">
      {kicker ? <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{kicker}</div> : null}
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p> : null}
    </div>
  );
}

export function ContactPill({ email, label = 'Contact the ads desk' }: { email: string; label?: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <Mail className="h-4 w-4" />
      {label}
    </a>
  );
}