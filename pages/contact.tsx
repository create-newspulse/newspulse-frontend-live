import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Mail, MessageSquareQuote, Phone, ShieldAlert, UserRound, X } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'Newspulse.team@gmail.com';
const adsEmail = 'newspulse.ads@gmail.com';
const adsMailtoHref = 'mailto:newspulse.ads@gmail.com?subject=News%20Pulse%20Advertising%20Inquiry';

const CONTACT_REASON_OPTIONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'copyright', label: 'Copyright / Permission / Complaint' },
  { value: 'feedback', label: 'Feedback / Correction' },
  { value: 'technical', label: 'Technical Issue' },
] as const;

type ContactReason = (typeof CONTACT_REASON_OPTIONS)[number]['value'];

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  reason: ContactReason;
  message: string;
};

type ContactPageProps = {
  initialType: string | null;
};

const ADS_KEYWORD_PATTERN = /(^|\b)(advertis(e|ing|ement)?|ads?|sponsor(ship|ed)?|promotion(al)?|media\s*kit|sponsored\s+content|business\s+promotion|partnership|collaboration)(\b|$)/i;

function resolveReason(value: string | string[] | null | undefined): ContactReason {
  const normalized = String(Array.isArray(value) ? value[0] || '' : value || '').trim().toLowerCase();
  if (normalized === 'copyright') return 'copyright';
  if (normalized === 'general') return 'general';
  if (normalized === 'technical') return 'technical';
  return 'general';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasAdsKeywords(message: string): boolean {
  return ADS_KEYWORD_PATTERN.test(message);
}

export default function ContactPage({ initialType }: ContactPageProps) {
  const router = useRouter();
  const initialReason = useMemo(() => resolveReason(initialType), [initialType]);
  const [form, setForm] = useState<ContactFormState>({
    name: '',
    email: '',
    phone: '',
    reason: initialReason,
    message: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showAdsGuard, setShowAdsGuard] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof router.query.type === 'undefined') return;
    setForm((current) => ({ ...current, reason: resolveReason(router.query.type) }));
  }, [router.isReady, router.query.type]);

  function openAdsGuard(): void {
    setError(null);
    setStatus(null);
    setShowAdsGuard(true);
  }

  return (
    <PublicBusinessPageLayout
      title="Contact News Pulse"
      description="Use the News Pulse public contact form for copyright requests, permissions, complaints, and general questions."
      contactEmail={contactEmail}
      contactHref="#contact-form"
      contactAriaLabel="Jump to contact form"
      contactTitle="Jump to contact form"
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="sm:p-10">
          <PageEyebrow tone="slate">Public contact and permissions</PageEyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Contact the News Pulse team.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Use this public contact form for copyright permissions, complaints, feedback, corrections, technical issues, and general site concerns.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            <Mail className="h-4 w-4" />
            {contactEmail}
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Support note</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Form ready, email fallback available</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            This public form is ready for user input. If message delivery is unavailable, please email Newspulse.team@gmail.com directly.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Copyright / Permission / Complaint requests</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Feedback, corrections, technical issues, and general site concerns</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">For advertising, media kit, sponsorship, sponsored content, partnership, collaboration, or business promotion inquiries, please contact newspulse.ads@gmail.com.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
        <div id="contact-form">
          <SurfacePanel>
            <SectionHeading
              title="Send a message"
              description="Fill in the form below. General inquiries use the default reason, and copyright requests are preselected when you open this page from the copyright policy."
              kicker="Contact form"
            />

            <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-5 py-4 text-sm leading-7 text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              For advertising, media kit, sponsorship, sponsored content, partnership, collaboration, or business promotion inquiries, please contact newspulse.ads@gmail.com.
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                setStatus(null);

                if (!form.name.trim()) {
                  setError('Please enter your name.');
                  return;
                }
                if (!form.email.trim() || !isValidEmail(form.email.trim())) {
                  setError('Please enter a valid email address.');
                  return;
                }
                if (!form.message.trim()) {
                  setError('Please enter a message.');
                  return;
                }
                if (hasAdsKeywords(form.message)) {
                  openAdsGuard();
                  return;
                }

                setStatus('Please email Newspulse.team@gmail.com directly.');
              }}
            >
              <div>
                <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-800">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-800">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="you@example.com"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-phone" className="block text-sm font-semibold text-slate-800">Phone optional</label>
                  <input
                    id="contact-phone"
                    name="phone"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label htmlFor="contact-reason" className="block text-sm font-semibold text-slate-800">Reason</label>
                  <select
                    id="contact-reason"
                    name="reason"
                    value={form.reason}
                    onChange={(event) => {
                      const nextReason = event.target.value as ContactReason;
                      setForm((current) => ({ ...current, reason: nextReason }));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {CONTACT_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-800">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={7}
                  value={form.message}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Tell the News Pulse team how they can help."
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Submit
                </button>
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                {status ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</div> : null}
              </div>
            </form>
          </SurfacePanel>
        </div>

        <div className="grid gap-5">
          <SurfacePanel>
            <SectionHeading title="Contact email" kicker="Direct address" />
            <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                <Mail className="h-4 w-4 text-slate-600" />
                {contactEmail}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                If form delivery is unavailable, please email Newspulse.team@gmail.com directly.
              </p>
            </div>
          </SurfacePanel>

          <SurfacePanel>
            <SectionHeading title="What to include" kicker="Helpful details" />
            <div className="mt-5 space-y-3">
              {[
                { icon: UserRound, text: 'Include your full name and a working reply email address.' },
                { icon: Phone, text: 'Add a phone number only if you want a callback from the News Pulse team.' },
                { icon: ShieldAlert, text: 'For copyright or complaint requests, include the article URL or copied content details.' },
                { icon: MessageSquareQuote, text: 'Explain the request clearly so the correct team can review it faster.' },
              ].map((item) => (
                <div key={item.text} className="flex gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                  <item.icon className="mt-1 h-4 w-4 shrink-0 text-slate-700" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </SurfacePanel>
        </div>
      </section>

      {showAdsGuard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.38)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Advertising Inquiry</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Advertising Inquiry</div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdsGuard(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Close advertising inquiry notice"
                title="Close advertising inquiry notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>For advertising, media kit, sponsorship, sponsored content, partnership, collaboration, or business promotion inquiries, please contact our ads team directly:</p>
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-5 py-4 text-base font-semibold text-slate-900">
                {adsEmail}
              </div>
              <p>This helps us respond faster and keep business inquiries separate from general copyright/contact requests.</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={adsMailtoHref}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Email Ads Team
              </a>
              <Link
                href="/advertise"
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Go to Advertise Page
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </PublicBusinessPageLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ContactPageProps> = async (context) => ({
  props: {
    initialType: String(context.query.type || '').trim() || null,
  },
});