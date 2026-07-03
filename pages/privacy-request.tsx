import React from 'react';
import { ClipboardList, Mail, ShieldCheck, UserRoundCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'privacy@newspulse.co.in';
const submitSuccessMessage = 'Your privacy request has been received. Please check your email and verify the request. News Pulse will review verified requests.';
const submitErrorFallback = 'We could not submit your request right now. Please try again or email privacy@newspulse.co.in.';

const requestTypeOptions = [
  { label: 'Access my personal data', value: 'access' },
  { label: 'Correct/update my personal data', value: 'correction' },
  { label: 'Delete/erase my personal data', value: 'deletion' },
  { label: 'Withdraw consent', value: 'withdraw_consent' },
  { label: 'Privacy/data grievance', value: 'grievance' },
  { label: 'Other privacy request', value: 'other' },
] as const;

const requestTypes = [
  'Access my personal data',
  'Correct/update my personal data',
  'Delete/erase my personal data',
  'Withdraw consent',
  'Privacy/data grievance',
  'Other privacy request',
] as const;

const requestDetails = [
  'Full name',
  'Email/mobile used on News Pulse',
  'Request type',
  'Clear message',
  'Any reference ID, if available',
] as const;

type PrivacyRequestFormState = {
  fullName: string;
  email: string;
  mobile: string;
  requestType: string;
  message: string;
  referenceId: string;
};

const initialFormState: PrivacyRequestFormState = {
  fullName: '',
  email: '',
  mobile: '',
  requestType: 'access',
  message: '',
  referenceId: '',
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function PrivacyRequestPage() {
  const mailSubject = 'Privacy Request - News Pulse';
  const [form, setForm] = React.useState<PrivacyRequestFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  function updateField<K extends keyof PrivacyRequestFormState>(field: K, value: PrivacyRequestFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm(): string | null {
    if (!form.fullName.trim()) return 'Please enter your full name.';
    if (!form.email.trim() || !isValidEmail(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.requestType.trim()) return 'Please select a request type.';
    if (!form.message.trim()) return 'Please enter your message.';
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus(null);
    setSubmitError(null);

    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/privacy/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          requestType: form.requestType,
          message: form.message.trim(),
          referenceId: form.referenceId.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        throw new Error(submitErrorFallback);
      }

      setSubmitStatus(submitSuccessMessage);
      setSubmitError(null);
      setForm(initialFormState);
    } catch {
      setSubmitStatus(null);
      setSubmitError(submitErrorFallback);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicBusinessPageLayout
      title="Privacy Request"
      description="The News Pulse privacy request page explains how users can submit access, correction, deletion, withdrawal of consent, and privacy grievance requests by email."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`}
      contactAriaLabel="Email News Pulse privacy request desk"
      contactTitle="Email News Pulse privacy request desk"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">Privacy request</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Privacy Request
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse uses this single public route for privacy and personal data requests. Users may request access, correction, update, deletion or erasure, withdrawal of consent, privacy grievance review, or other privacy-related support through the published privacy email.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            This page can submit a privacy request for review. It does not perform automatic deletion or automatic data changes.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Email Privacy Request
            </a>
            <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {contactEmail}
            </a>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Safety notice</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Requests are reviewed before action is taken.</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            Submitting a privacy request does not result in automatic deletion or automatic changes. News Pulse may verify your identity before processing any access, correction, deletion, withdrawal of consent, or privacy grievance request. Requests that appear false, duplicate, abusive, incomplete, or unauthorised may be rejected or closed after review. Please submit requests only for personal data that belongs to you. Do not impersonate another person or submit false or frivolous requests.
          </p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading title="Submit a Privacy Request" kicker="Request form" />
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Submitting a privacy request does not automatically delete or change any data. News Pulse may verify your identity before processing the request.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="privacy-request-full-name" className="block text-sm font-semibold text-slate-800">Full name</label>
                <input
                  id="privacy-request-full-name"
                  name="fullName"
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label htmlFor="privacy-request-email" className="block text-sm font-semibold text-slate-800">Email</label>
                <input
                  id="privacy-request-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="privacy-request-mobile" className="block text-sm font-semibold text-slate-800">Mobile (optional)</label>
                <input
                  id="privacy-request-mobile"
                  name="mobile"
                  value={form.mobile}
                  onChange={(event) => updateField('mobile', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label htmlFor="privacy-request-type" className="block text-sm font-semibold text-slate-800">Request type</label>
                <select
                  id="privacy-request-type"
                  name="requestType"
                  value={form.requestType}
                  onChange={(event) => updateField('requestType', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {requestTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="privacy-request-message" className="block text-sm font-semibold text-slate-800">Message</label>
              <textarea
                id="privacy-request-message"
                name="message"
                rows={6}
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Explain your privacy request clearly."
                required
              />
            </div>

            <div>
              <label htmlFor="privacy-request-reference-id" className="block text-sm font-semibold text-slate-800">Reference ID (optional)</label>
              <input
                id="privacy-request-reference-id"
                name="referenceId"
                value={form.referenceId}
                onChange={(event) => updateField('referenceId', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Optional reference ID"
              />
            </div>

            <p className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
              Submitting a privacy request does not automatically delete or change any data. News Pulse may verify your identity before processing the request.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Privacy Request'}
              </button>
              <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}`} className="text-sm font-semibold text-slate-700 underline">
                Email {contactEmail} instead
              </a>
            </div>

            {submitError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div> : null}
            {submitStatus ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitStatus}</div> : null}
          </form>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-50/90">
          <SectionHeading title="Request Types" kicker="What you can request" />
          <div className="mt-5 grid gap-3">
            {requestTypes.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <SectionHeading title="What to Include" kicker="Email checklist" />
          <div className="mt-5 grid gap-3">
            {requestDetails.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            Identity verification may be requested only when necessary.
          </p>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Privacy contact',
            body: contactEmail,
            Icon: Mail,
          },
          {
            title: 'Main rights page',
            body: 'Privacy Policy is the main News Pulse DPDP and privacy rights page.',
            Icon: UserRoundCheck,
          },
          {
            title: 'No automatic action',
            body: 'Requests are reviewed before any change is made to user data or consent handling.',
            Icon: ShieldCheck,
          },
        ].map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>
    </PublicBusinessPageLayout>
  );
}