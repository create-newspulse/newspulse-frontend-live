import React from 'react';
import { Clock3, Globe, Mail, ShieldCheck, UserRound } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';
import { usePublicComplianceSettings } from '../hooks/usePublicComplianceSettings';

const grievanceFormAnchor = '#grievance-form';
const grievanceOfficerFallback = 'To be appointed / Details will be updated shortly';
const chiefEditorFallback = 'Details will be updated shortly';
const privacyEmail = 'privacy@newspulse.co.in';
const submitSuccessMessage = 'Your grievance has been submitted successfully. Our team will review it as per the applicable timeline.';
const declarationText = 'I hereby declare that the information furnished above is true, correct, and complete to the best of my knowledge and belief.';

type GrievanceFormState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  articleReference: string;
  publicationDate: string;
  publicationViolation: string;
  violationSummary: string;
  declarationAccepted: boolean;
};

const initialFormState: GrievanceFormState = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  articleReference: '',
  publicationDate: '',
  publicationViolation: '',
  violationSummary: '',
  declarationAccepted: false,
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function GrievanceRedressalPage() {
  const { settings: complianceSettings } = usePublicComplianceSettings();
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<GrievanceFormState>(initialFormState);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const grievanceFormRef = React.useRef<HTMLFormElement | null>(null);
  const fullNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const founderName = complianceSettings.founderName;
  const grievanceOfficer = complianceSettings.grievanceOfficerName || grievanceOfficerFallback;
  const grievanceEmail = complianceSettings.grievanceEmail;
  const grievanceLocation = complianceSettings.grievanceOfficerLocation;
  const chiefEditor = complianceSettings.chiefEditorName || chiefEditorFallback;
  const entityName = complianceSettings.publisherEntity;
  const websiteUrl = complianceSettings.websiteUrl;
  const submitErrorMessage = `We could not submit your grievance right now. Please email ${grievanceEmail} directly.`;

  function updateField<K extends keyof GrievanceFormState>(field: K, value: GrievanceFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm(): string | null {
    if (!form.fullName.trim()) return 'Please enter your full name.';
    if (!form.email.trim() || !isValidEmail(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.phone.trim()) return 'Please enter your phone number.';
    if (!form.address.trim()) return 'Please enter your address for communication with PIN Code.';
    if (!form.articleReference.trim()) return 'Please enter the article, page URL, headline, or content reference.';
    if (!form.publicationDate.trim()) return 'Please enter the publication date.';
    if (!form.publicationViolation.trim()) return 'Please describe whether the entire publication or a specific part is violative.';
    if (!form.violationSummary.trim()) return 'Please provide a detailed summary of the grievance.';
    if (!form.declarationAccepted) return 'Please accept the declaration before submitting.';
    return null;
  }

  const scrollToForm = React.useCallback(() => {
    grievanceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    fullNameInputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!showForm) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollToForm();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [showForm, scrollToForm]);

  const openForm = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (showForm) {
      scrollToForm();
      return;
    }

    setShowForm(true);
  }, [scrollToForm, showForm]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/grievance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          articleReference: form.articleReference.trim(),
          publicationDate: form.publicationDate.trim(),
          publicationViolation: form.publicationViolation.trim(),
          violationSummary: form.violationSummary.trim(),
          declarationAccepted: form.declarationAccepted,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        throw new Error(`Grievance submit failed: ${response.status}`);
      }

      setSuccess(submitSuccessMessage);
      setForm(initialFormState);
    } catch {
      setError(submitErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicBusinessPageLayout
      title="Grievance Redressal"
      description="Official News Pulse grievance redressal information and submission form for complaints related to content, corrections, copyright, privacy, or legal concerns."
      contactEmail={grievanceEmail}
      contactHref={grievanceFormAnchor}
      contactOnClick={openForm}
      contactAriaLabel="Email the News Pulse grievance officer"
      contactTitle="Email the News Pulse grievance officer"
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="sm:p-10">
          <PageEyebrow tone="slate">Official grievance contact</PageEyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Grievance Redressal
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse is committed to responsible publishing, transparency, and timely resolution of valid complaints related to content, corrections, copyright, privacy, or legal concerns.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <ContactPill
              email={grievanceEmail}
              label={`Editorial / Content Grievance: ${grievanceEmail}`}
              href={grievanceFormAnchor}
              onClick={openForm}
              ariaLabel={grievanceEmail}
              title={grievanceEmail}
            />
            <ContactPill
              email={privacyEmail}
              label={`Privacy / DPDP Request: ${privacyEmail}`}
              href={`mailto:${privacyEmail}`}
              ariaLabel={privacyEmail}
              title={privacyEmail}
            />
          </div>
          <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Review Process</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Timeline</div>
            <div className="mt-5 inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
              <Clock3 className="h-4 w-4 text-slate-600" />
              Response timeline
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              We will acknowledge valid grievances within 24 hours and aim to resolve them within 15 days, where applicable.
            </p>
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Response standard</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Acknowledgement within 24 hours</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            We will acknowledge valid grievances within 24 hours and aim to resolve them within 15 days, where applicable.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Submit the grievance form below for direct review by the News Pulse team.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Provide precise publication references and a detailed description of the alleged violation.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">For editorial or content grievances, use {grievanceEmail}. For privacy or DPDP requests, use {privacyEmail}.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Publisher / Entity', body: entityName },
          { icon: UserRound, title: 'Founder / Publisher', body: founderName },
          { icon: UserRound, title: 'Chief Editor', body: chiefEditor },
          {
            icon: UserRound,
            title: 'Grievance Officer',
            body: grievanceOfficer,
          },
          { icon: Mail, title: 'Editorial / Content Grievance', body: grievanceEmail },
          { icon: Mail, title: 'Privacy / DPDP Request', body: privacyEmail },
          { icon: Globe, title: 'Location', body: grievanceLocation },
        ].map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-slate-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">{item.body}</div>
          </SurfacePanel>
        ))}
      </section>

      {showForm ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-stretch xl:gap-7">
          <SurfacePanel className="sm:p-8 lg:flex lg:h-full lg:flex-col">
            {success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
            <SectionHeading
              title="Submit a grievance"
              description="Provide the publication details, the part alleged to be violative, and a clear summary for formal review."
              kicker="Public grievance form"
            />

            <form id="grievance-form" ref={grievanceFormRef} className="mt-6 grid gap-5 lg:flex lg:flex-1 lg:flex-col" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="grievance-full-name" className="block text-sm font-semibold text-slate-800">Full Name</label>
              <input
                id="grievance-full-name"
                ref={fullNameInputRef}
                name="fullName"
                required
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Your full name"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="grievance-email" className="block text-sm font-semibold text-slate-800">Email Address</label>
                <input
                  id="grievance-email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="grievance-phone" className="block text-sm font-semibold text-slate-800">Phone Number</label>
                <input
                  id="grievance-phone"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Your phone number"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grievance-address" className="block text-sm font-semibold text-slate-800">Address for communication with PIN Code</label>
              <textarea
                id="grievance-address"
                name="address"
                required
                rows={3}
                value={form.address}
                onChange={(event) => updateField('address', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Full address including PIN Code"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="grievance-article-reference" className="block text-sm font-semibold text-slate-800">Article/Page URL or headline/content reference</label>
                <input
                  id="grievance-article-reference"
                  name="articleReference"
                  required
                  value={form.articleReference}
                  onChange={(event) => updateField('articleReference', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="https://www.newspulse.co.in/... or headline reference"
                />
              </div>

              <div>
                <label htmlFor="grievance-publication-date" className="block text-sm font-semibold text-slate-800">Date of publication</label>
                <input
                  id="grievance-publication-date"
                  name="publicationDate"
                  type="date"
                  required
                  value={form.publicationDate}
                  onChange={(event) => updateField('publicationDate', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grievance-publication-violation" className="block text-sm font-semibold text-slate-800">Whether the entire publication is violative of the Code of Ethics or any specific part</label>
              <textarea
                id="grievance-publication-violation"
                name="publicationViolation"
                required
                rows={4}
                value={form.publicationViolation}
                onChange={(event) => updateField('publicationViolation', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="State whether the entire publication or a specific section is alleged to be violative."
              />
            </div>

            <div>
              <label htmlFor="grievance-violation-summary" className="block text-sm font-semibold text-slate-800">Detailed summary of how the content violates the Code of Ethics or the specific rule/section</label>
              <textarea
                id="grievance-violation-summary"
                name="violationSummary"
                required
                rows={6}
                value={form.violationSummary}
                onChange={(event) => updateField('violationSummary', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Describe the grievance in detail, including the relevant Code of Ethics rule or section if known."
              />
            </div>

            <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-3.5 text-sm leading-7 text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.22)]">
              <input
                type="checkbox"
                name="declarationAccepted"
                checked={form.declarationAccepted}
                onChange={(event) => updateField('declarationAccepted', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              <span>{declarationText}</span>
            </label>

            <div className="flex flex-col gap-3 pt-2 lg:mt-auto lg:pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
              </button>
              {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            </div>
            </form>
          </SurfacePanel>

          <div className="lg:h-full">
            <SurfacePanel className="sm:p-8 lg:flex lg:h-full lg:flex-col">
              <SectionHeading title="Grievance Help Desk" kicker="Support panel" />
              <div className="mt-5 space-y-5 lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:space-y-0">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/92 px-5 py-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
                  <div className="text-base font-black tracking-tight text-slate-950">How your grievance will be reviewed</div>
                  <div className="mt-4 space-y-3.5">
                    {[
                      { step: '01', title: 'Submission received' },
                      { step: '02', title: 'Acknowledgement within 24 hours' },
                      { step: '03', title: 'Editorial review' },
                      { step: '04', title: 'Decision / action within 15 days, where applicable' },
                    ].map((item, index, items) => (
                      <div key={item.step} className="relative flex gap-4 pl-1">
                        <div className="relative flex shrink-0 flex-col items-center">
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 text-sm font-black text-slate-800 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.28)]">
                            {item.step}
                          </div>
                          {index < items.length - 1 ? <div className="mt-2 h-8 w-px bg-slate-200" /> : null}
                        </div>
                        <div className="pt-1 text-sm font-semibold leading-6 text-slate-700">{item.title}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200/80 bg-white/92 px-5 py-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.20)]">
                  <div className="text-base font-black tracking-tight text-slate-950">Before submitting</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    {[
                      'Keep the article/page URL or headline ready.',
                      'Clearly explain the specific issue.',
                      'Provide correct contact details.',
                      'Share supporting proof or context if available.',
                    ].map((item) => (
                      <div key={item} className="flex gap-3">
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                        <div>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200/80 bg-white/92 px-5 py-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.20)]">
                  <div className="text-base font-black tracking-tight text-slate-950">Important note</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Please submit only genuine, complete, and accurate information. Incomplete or unclear grievances may require additional clarification.
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-5 py-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.18)]">
                  <div className="text-base font-black tracking-tight text-slate-950">Official contact</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    For direct communication, use:
                  </p>
                  <div className="mt-3 space-y-1 text-sm font-semibold text-slate-800">
                    <div>{entityName}</div>
                    <div>{founderName}</div>
                    <div>{grievanceOfficer}</div>
                    <div>{grievanceLocation}</div>
                    <div>{grievanceEmail}</div>
                    <div>{websiteUrl}</div>
                  </div>
                </div>
              </div>
            </SurfacePanel>
          </div>
        </section>
      ) : null}

    </PublicBusinessPageLayout>
  );
}