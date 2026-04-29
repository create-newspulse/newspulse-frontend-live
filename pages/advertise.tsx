import React, { useMemo, useState } from "react";
import Toast from "../components/community-reporter/Toast";

function buildMailtoHref(email: string, subject: string, fields: { name: string; email: string; message: string }): string {
  const body = [
    `Name: ${fields.name || '-'}`,
    `Email: ${fields.email || '-'}`,
    '',
    fields.message || '-',
  ].join('\n');

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AdvertisePage() {
  const email = "newspulse.ads@gmail.com";

  const defaultSubject = useMemo(() => "Advertise on News Pulse", []);

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
              Email: <a className="font-semibold underline" href={`mailto:${email}?subject=${encodeURIComponent(defaultSubject)}`}>{email}</a>
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
              const message = String(fd.get("message") || "").trim();

              const href = buildMailtoHref(email, defaultSubject, { name, email: fromEmail, message });
              window.location.href = href;
              setToast('Opening email app');
              setStatus('Your email app should open with the inquiry details filled in.');
              setError(null);
              setIsSubmitting(false);
            }}
          >
            <div>
              <label className="block text-sm font-semibold text-slate-800">Name</label>
              <input
                name="name"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Email</label>
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Message</label>
              <textarea
                name="message"
                rows={5}
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
                href={buildMailtoHref(email, defaultSubject, { name: '', email: '', message: '' })}
              >
                Or email us directly
              </a>
            </div>

            {error ? <div className="text-xs font-semibold text-red-600">{error}</div> : null}
            {status ? <div className="text-xs text-slate-500">{status}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
