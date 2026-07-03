import React, { useRef, useState } from 'react';
import { ArrowRight, Briefcase, Globe2, Handshake, Layers3, Mail, Megaphone, MonitorSmartphone, Newspaper, PanelTop, RectangleHorizontal, Ribbon, ScrollText } from 'lucide-react';
import PublicBusinessPageLayout, { ContactPill, PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';
import { PUBLIC_AD_INQUIRY_OPTIONS, getPublicAdOpportunityLabel, normalizePublicAdInquiryValue } from '../src/lib/publicAdOpportunities';

const contactEmail = 'newspulse.ads@gmail.com';
const suggestedSubject = 'Advertising Enquiry - [Brand Name] - [Campaign Type]';
const submitSuccessMessage = 'Your advertising enquiry has been received. News Pulse ads desk will review it.';
const submitErrorFallback = 'Your enquiry could not be submitted right now. Please try again or email newspulse.ads@gmail.com directly.';

const whyAdvertiseCards = [
  {
    icon: Globe2,
    title: 'Trusted reader environment',
    body: 'News Pulse is designed for readers following breaking updates, regional stories, national news, business, technology, sports, entertainment, youth content, and community reports.',
  },
  {
    icon: Briefcase,
    title: 'Campaign flexibility',
    body: 'Advertising with News Pulse can support brand visibility, campaign awareness, launches, public-interest campaigns, and category-based promotion.',
  },
  {
    icon: Layers3,
    title: 'Multi-surface presence',
    body: 'Campaigns can combine display placements, sponsorships, and branded storytelling depending on goals, timing, and suitability.',
  },
  {
    icon: Handshake,
    title: 'Direct ads desk access',
    body: 'The page is built to move quickly from public overview into a practical enquiry with the News Pulse ads desk.',
  },
] as const;

const adFormatCards = [
  { title: 'Homepage Placements', Icon: PanelTop },
  { title: 'Category Placements', Icon: RectangleHorizontal },
  { title: 'Article Placements', Icon: Newspaper },
  { title: 'Display Ads', Icon: MonitorSmartphone },
  { title: 'Sponsored Features', Icon: Ribbon },
  { title: 'Sponsored Articles', Icon: ScrollText },
  { title: 'Branded Storytelling', Icon: Megaphone },
  { title: 'Ticker Highlights', Icon: ArrowRight },
] as const;

const enquiryChecklist = [
  'Brand or business name',
  'Contact person',
  'Email and phone, if available',
  'Campaign goal',
  'Preferred placement type',
  'Target region or audience',
  'Campaign dates',
  'Budget range, if available',
  'Creative material or landing page, if ready',
] as const;

export default function AdvertiseWithUsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  function openEnquiryForm(): void {
    setIsFormOpen(true);
    setSubmitError(null);
    setSubmitStatus(null);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  return (
    <PublicBusinessPageLayout
      title="Advertise with News Pulse"
      description="News Pulse offers advertising and sponsorship opportunities across homepage, article, ticker, and sponsored-content environments for brands seeking trusted, multilingual public reach."
      contactEmail={contactEmail}
      tone="amber"
    >
      <SurfacePanel className="relative overflow-hidden p-8 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.10),transparent_28%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
          <div className="max-w-3xl">
            <PageEyebrow tone="amber">Advertising and sponsorship</PageEyebrow>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.15rem] sm:leading-[1.03]">
              Advertise with News Pulse
            </h1>
            <div className="mt-4 max-w-3xl text-lg font-semibold text-slate-800 sm:text-[1.3rem]">
              Reach engaged readers through display placements, sponsorships, and branded storytelling across News Pulse.
            </div>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-[17px]">
              News Pulse offers public-facing advertising and sponsorship opportunities for brands, businesses, campaigns, and partners looking to connect with readers in trusted news and content environments.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openEnquiryForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start an Enquiry
                <ArrowRight className="h-4 w-4" />
              </button>
              <ContactPill email={contactEmail} label="Email Ads Desk" href={`mailto:${contactEmail}?subject=${encodeURIComponent(suggestedSubject)}`} />
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent('Media Kit Request - News Pulse')}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Request Media Kit
              </a>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.38)] backdrop-blur">
            {[
              { label: 'Audience reach', value: 'Public news, category, and article environments designed for brand visibility and engaged reading sessions.' },
              { label: 'Campaign formats', value: 'Display, ticker, sponsored features, sponsored articles, and branded storytelling options can be discussed with the ads desk.' },
              { label: 'Trust note', value: 'Sponsored or promotional content must be clearly labelled wherever applicable.' },
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
        {whyAdvertiseCards.map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-amber-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0">
          <SectionHeading
            kicker="Why Advertise with News Pulse"
            title="Why Advertise with News Pulse"
            description="Advertising with News Pulse can support brand visibility, campaign awareness, product or service launches, public-interest campaigns, sponsored storytelling, local and regional reach, and category-based promotion."
          />
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading
            kicker="Advertising Opportunities"
            title="Advertising Opportunities"
            description="News Pulse may offer advertising and sponsorship formats such as the placements and content paths below. Availability may depend on placement, campaign type, content suitability, and editorial policy."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {adFormatCards.map(({ title, Icon }) => (
              <div key={title} className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-base font-black tracking-tight text-slate-950">{title}</div>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8eb_0%,#ffffff_100%)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%)]" />
          <div className="relative">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Trust note</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Sponsored content disclosure</div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Sponsored articles, brand promotions, paid collaborations, or partner content must be clearly identified where applicable. Sponsored or promotional content should not be presented as independent editorial reporting.
            </p>
            <div className="mt-6 rounded-[22px] border border-amber-200/80 bg-amber-50/85 px-4 py-4 text-sm font-semibold leading-7 text-amber-900">
              Sponsored or promotional content must be clearly labelled wherever applicable.
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SurfacePanel className="min-w-0">
          <SectionHeading
            kicker="Campaign Enquiry"
            title="Campaign Enquiry"
            description="When contacting the ads desk, include the details below so the discussion can move quickly into fit, availability, and next steps."
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {enquiryChecklist.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_14px_32px_-30px_rgba(15,23,42,0.26)]">
                {item}
              </div>
            ))}
          </div>

          <div
            id="advertise-enquiry-form"
            ref={formRef}
            className={`mt-6 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)] ${isFormOpen ? '' : 'hidden'}`}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Enquiry form</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Start an Enquiry</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Share your campaign details below. Required fields help the News Pulse ads desk review your enquiry properly.
            </p>

            <form
              className="mt-6 grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (isSubmitting) return;

                setSubmitError(null);
                setSubmitStatus(null);
                setIsSubmitting(true);

                const form = event.currentTarget;
                const formData = new FormData(form);
                const name = String(formData.get('name') || '').trim();
                const company = String(formData.get('company') || '').trim();
                const email = String(formData.get('email') || '').trim();
                const phone = String(formData.get('phone') || '').trim();
                const campaignType = String(formData.get('campaignType') || '').trim();
                const preferredAdSlot = normalizePublicAdInquiryValue(String(formData.get('preferredAdSlot') || '').trim());
                const preferredAdSlotLabel = getPublicAdOpportunityLabel(preferredAdSlot);
                const campaignGoal = String(formData.get('campaignGoal') || '').trim();
                const preferredDates = String(formData.get('preferredDates') || '').trim();
                const budget = String(formData.get('budget') || '').trim();
                const message = String(formData.get('message') || '').trim().replace(/\r\n/g, '\n');

                if (!name) {
                  setSubmitError('Please enter your name.');
                  setIsSubmitting(false);
                  return;
                }

                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  setSubmitError('Please enter a valid email address.');
                  setIsSubmitting(false);
                  return;
                }

                if (!campaignGoal) {
                  setSubmitError('Please enter your campaign goal.');
                  setIsSubmitting(false);
                  return;
                }

                if (!message) {
                  setSubmitError('Please enter your message.');
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
                      company,
                      email,
                      phone,
                      campaignType,
                      preferredAdSlot,
                      preferredAdSlotLabel,
                      campaignGoal,
                      preferredDates,
                      budget,
                      message,
                      slot: preferredAdSlot,
                      slotLabel: preferredAdSlotLabel,
                      target: campaignGoal,
                      startDate: preferredDates,
                      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
                    }),
                  });

                  const result = await response.json().catch(() => null);
                  if (!response.ok || result?.ok === false) {
                    throw new Error(String(result?.message || submitErrorFallback));
                  }

                  setSubmitStatus(submitSuccessMessage);
                  setSubmitError(null);
                  form.reset();
                } catch (error) {
                  setSubmitStatus(null);
                  setSubmitError(error instanceof Error && error.message ? error.message : submitErrorFallback);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ad-enquiry-name" className="block text-sm font-semibold text-slate-800">Name</label>
                  <input
                    id="ad-enquiry-name"
                    name="name"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="ad-enquiry-company" className="block text-sm font-semibold text-slate-800">Company</label>
                  <input
                    id="ad-enquiry-company"
                    name="company"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ad-enquiry-email" className="block text-sm font-semibold text-slate-800">Email</label>
                  <input
                    id="ad-enquiry-email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="ad-enquiry-phone" className="block text-sm font-semibold text-slate-800">Phone</label>
                  <input
                    id="ad-enquiry-phone"
                    name="phone"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ad-enquiry-campaign-type" className="block text-sm font-semibold text-slate-800">Campaign Type</label>
                  <input
                    id="ad-enquiry-campaign-type"
                    name="campaignType"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label htmlFor="ad-enquiry-slot" className="block text-sm font-semibold text-slate-800">Preferred Ad Slot</label>
                  <select
                    id="ad-enquiry-slot"
                    name="preferredAdSlot"
                    defaultValue="NOT_SURE"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                  >
                    {PUBLIC_AD_INQUIRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ad-enquiry-goal" className="block text-sm font-semibold text-slate-800">Campaign Goal</label>
                  <input
                    id="ad-enquiry-goal"
                    name="campaignGoal"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Required"
                  />
                </div>

                <div>
                  <label htmlFor="ad-enquiry-dates" className="block text-sm font-semibold text-slate-800">Preferred Dates</label>
                  <input
                    id="ad-enquiry-dates"
                    name="preferredDates"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ad-enquiry-budget" className="block text-sm font-semibold text-slate-800">Budget</label>
                <input
                  id="ad-enquiry-budget"
                  name="budget"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label htmlFor="ad-enquiry-message" className="block text-sm font-semibold text-slate-800">Message</label>
                <textarea
                  id="ad-enquiry-message"
                  name="message"
                  rows={6}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                  placeholder="Tell the News Pulse ads desk about your campaign, preferred placement, and anything else that will help review the enquiry."
                />
              </div>

              <p className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm leading-7 text-amber-900">
                News Pulse will use your business contact details only to respond to your advertising or partnership inquiry.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit Enquiry'}
                </button>
                <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(suggestedSubject)}`} className="text-sm font-semibold text-slate-700 underline">
                  Email Ads Desk instead
                </a>
              </div>

              {submitError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div> : null}
              {submitStatus ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitStatus}</div> : null}
            </form>
          </div>
        </SurfacePanel>

        <SurfacePanel className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8eb_0%,#ffffff_100%)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_48%)]" />
          <div className="relative">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Advertising Review</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Advertising review</div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              News Pulse may review advertising and sponsorship enquiries before approval. We may reject campaigns that are misleading, unsafe, unlawful, hateful, defamatory, harmful, or against News Pulse standards.
            </p>
            <div className="mt-6 rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-4 text-sm leading-7 text-slate-600">
              Availability may depend on placement, campaign type, content suitability, and editorial policy.
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact the Ads Desk</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">Contact the Ads Desk</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              For advertising, sponsorships, media kit requests, or brand partnership enquiries, contact the News Pulse ads desk.
            </p>
            <div className="mt-4 text-sm font-semibold text-slate-700">Suggested subject line: {suggestedSubject}</div>
            <div className="mt-2 text-sm text-slate-600">Example: Advertising Enquiry - ABC Brand - Homepage Campaign</div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <a
              href="#advertise-enquiry-form"
              onClick={(event) => {
                event.preventDefault();
                openEnquiryForm();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              <Mail className="h-4 w-4" />
              Start an Enquiry
            </a>
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(suggestedSubject)}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Email Ads Desk
            </a>
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent('Media Kit Request - News Pulse')}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Request Media Kit
            </a>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}