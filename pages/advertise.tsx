import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Toast from "../components/community-reporter/Toast";

const CONTACT_EMAIL = "newspulse.ads@gmail.com";
const SUBMIT_SUCCESS_MESSAGE = "Inquiry sent successfully. Our ads team will contact you shortly.";
const SUBMIT_ERROR_MESSAGE = "Inquiry could not be sent right now. Please email newspulse.ads@gmail.com directly.";

const AD_SLOT_OPTIONS = [
  { value: 'NOT_SURE', label: 'Not sure / Need suggestion' },
  { value: 'HOME_728x90', label: 'Home Banner 728x90' },
  { value: 'FOOTER_BANNER_728x90', label: 'Footer Banner 728x90' },
  { value: 'HOME_RIGHT_300x250', label: 'Home Right Rail 300x250' },
  { value: 'HOME_RIGHT_300x600', label: 'Home Right Rail 300x600 Half Page' },
  { value: 'HOME_BILLBOARD_970x250', label: 'Home Billboard 970x250 Premium' },
  { value: 'LIVE_UPDATE_SPONSOR', label: 'Live Update Sponsor' },
  { value: 'BREAKING_SPONSOR', label: 'Breaking Sponsor' },
  { value: 'ARTICLE_INLINE', label: 'Article Inline' },
  { value: 'ARTICLE_END', label: 'Article End' },
  { value: 'SPONSORED_FEATURE', label: 'Sponsored Feature' },
  { value: 'SPONSORED_ARTICLE', label: 'Sponsored Article' },
  { value: 'COMBO_CAMPAIGN', label: 'Combo Campaign' },
  { value: 'BREAKING_TICKER_RED', label: 'Breaking ticker red' },
  { value: 'LIVE_UPDATES_TICKER_BLUE', label: 'Live Updates ticker blue' },
  { value: 'BREAKING_PAGE_SPONSOR_LINE', label: '/breaking page sponsor line' },
];

function normalizeAdSlotValue(value: string): string {
  const normalized = String(value || '').trim();
  return AD_SLOT_OPTIONS.some((option) => option.value === normalized) ? normalized : 'NOT_SURE';
}

function getAdSlotLabel(value: string): string {
  return AD_SLOT_OPTIONS.find((option) => option.value === value)?.label || AD_SLOT_OPTIONS[0].label;
}

function buildDefaultMessage(): string {
  const lines = [
    'Ad slot:',
    'Campaign goals:',
    '',
    'Preferred dates:',
    '',
    'Budget:',
  ];
  return lines.filter((line, index) => line || index > 0).join('\n');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildMailtoHref(email: string, subject: string, fields: { name: string; email: string; slot: string; message: string }): string {
  const body = [
    `Name: ${fields.name || '-'}`,
    `Email: ${fields.email || '-'}`,
    `Slot: ${fields.slot || '-'}`,
    '',
    fields.message || '-',
  ].join('\n');

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AdvertisePage() {
  const router = useRouter();
  const slot = useMemo(() => {
    const value = router.query.slot;
    return normalizeAdSlotValue(String(Array.isArray(value) ? value[0] || '' : value || '').trim());
  }, [router.query.slot]);

  const defaultSubject = useMemo(() => "Advertise on News Pulse", []);
  const defaultMessage = useMemo(() => buildDefaultMessage(), []);

  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Toast message={toast} />
          <h1 className="text-2xl font-extrabold text-slate-900">Advertise on News Pulse</h1>
          <p className="mt-2 text-sm text-slate-600">
            Reach readers across Breaking, Regional, National, International, Business and Tech.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">Contact</div>
            <div className="mt-1 text-sm text-slate-700">
              Email: <a className="font-semibold underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(defaultSubject)}`}>{CONTACT_EMAIL}</a>
            </div>
          </div>

          <form
            className="mt-6 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (isSubmitting) return;
              setToast(null);
              setStatus(null);
              setError(null);
              setIsSubmitting(true);

              const form = e.currentTarget;
              const fd = new FormData(form);
              const name = String(fd.get("name") || "").trim();
              const fromEmail = String(fd.get("email") || "").trim();
              const phone = String(fd.get("phone") || "").trim();
              const company = String(fd.get("company") || "").trim();
              const selectedSlot = String(fd.get("slot") || "").trim();
              const selectedSlotLabel = getAdSlotLabel(selectedSlot);
              const budget = String(fd.get("budget") || "").trim();
              const target = String(fd.get("target") || "").trim();
              const startDate = String(fd.get("startDate") || "").trim();
              const message = String(fd.get("message") || "").trim().replace(/\r\n/g, '\n');

              if (!name) {
                setError('Please enter your name.');
                setIsSubmitting(false);
                return;
              }
              if (!fromEmail || !isValidEmail(fromEmail)) {
                setError('Please enter a valid email address.');
                setIsSubmitting(false);
                return;
              }
              if (!message) {
                setError('Please enter a message.');
                setIsSubmitting(false);
                return;
              }

              try {
                const response = await fetch('/api/public/ad-inquiries', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                  },
                  body: JSON.stringify({
                    name,
                    email: fromEmail,
                    phone,
                    company,
                    slot: selectedSlot,
                    slotLabel: selectedSlotLabel,
                    budget,
                    target,
                    startDate,
                    message,
                    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
                  }),
                });

                const result = await response.json().catch(() => null);
                if (!response.ok || result?.ok === false) throw new Error(`Inquiry submit failed: ${response.status}`);

                setToast(SUBMIT_SUCCESS_MESSAGE);
                setStatus(SUBMIT_SUCCESS_MESSAGE);
                setError(null);
                form.reset();
              } catch {
                setError(SUBMIT_ERROR_MESSAGE);
                setStatus(null);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div>
              <label className="block text-sm font-semibold text-slate-800">Name</label>
              <input
                name="name"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Email</label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="you@example.com"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-800">Phone</label>
                <input
                  name="phone"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">Company</label>
                <input
                  name="company"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-800">Ad slot</label>
                <select
                  key={slot || 'slot-select'}
                  name="slot"
                  defaultValue={slot}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {AD_SLOT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">Budget</label>
                <input
                  name="budget"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-800">Target audience</label>
                <input
                  name="target"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">Start date</label>
                <input
                  name="startDate"
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Message</label>
              <textarea
                key={slot || 'default-message'}
                name="message"
                rows={6}
                required
                defaultValue={defaultMessage}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Tell us your campaign goals, dates, and budget."
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={
                  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-bold border border-slate-200 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                }
              >
                {isSubmitting ? 'Sending…' : 'Send inquiry'}
              </button>
              <a
                className="text-sm font-semibold underline text-slate-700"
                href={buildMailtoHref(CONTACT_EMAIL, defaultSubject, { name: '', email: '', slot, message: defaultMessage })}
              >
                Or email us directly
              </a>
            </div>

            {error ? <div className="text-xs font-semibold text-red-600">{error}</div> : null}
            {status ? <div className="text-xs font-semibold text-emerald-700">{status}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
