import Link from 'next/link';
import React from 'react';
import { Cookie, LockKeyhole, ShieldCheck, UserRoundCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

const contactEmail = 'privacy@newspulse.co.in';

const trustCards = [
  {
    title: 'Limited Data',
    body: 'News Pulse aims to collect only the personal data that is necessary to respond, review, improve the website, or handle lawful requests.',
    Icon: UserRoundCheck,
  },
  {
    title: 'No Sale',
    body: 'News Pulse does not sell users’ personal information.',
    Icon: ShieldCheck,
  },
  {
    title: 'Secure Handling',
    body: 'Reasonable safeguards are used to protect information submitted through public website channels.',
    Icon: LockKeyhole,
  },
  {
    title: 'User Control',
    body: 'Users may request access, correction, update, erasure or deletion, withdrawal of consent, grievance review, or nomination through the published privacy channel.',
    Icon: Cookie,
  },
] as const;

const policySections = [
  {
    title: '1. Information We May Collect',
    body: [
      'News Pulse may collect only the personal data that is reasonably necessary when users interact with our website, such as name and email address submitted through contact forms, information submitted through grievance forms, community reporter submissions, news tips, photos, videos, story ideas, advertising or business enquiry details, and basic technical or analytics information such as browser type, device type, pages visited, and general usage patterns.',
      'News Pulse may also use cookies or similar technologies where enabled for analytics, performance, security, or advertising support. News Pulse does not ask users to submit unnecessary personal information.',
    ],
  },
  {
    title: '2. How We Use Information',
    body: [
      'Information submitted to News Pulse may be used for responding to contact requests, handling grievances or correction requests, reviewing community reporter submissions, communicating about editorial, business, or advertising enquiries, improving website performance and reader experience, maintaining website security, preventing misuse, and meeting legal, regulatory, or compliance requirements where applicable.',
    ],
  },
  {
    title: '3. No Sale of Personal Data',
    body: [
      'News Pulse does not sell users’ personal information.',
      'We do not publish private personal information submitted through contact forms, grievance forms, or reporter submissions unless required by law or with appropriate consent where applicable.',
    ],
  },
  {
    title: '4. DPDP and Privacy Rights',
    body: [
      'Users may request access to personal data, correction or update of personal data, erasure or deletion where applicable, withdrawal of consent where consent applies, grievance review, and nomination where recognised under applicable law.',
      `Requests must be sent to ${contactEmail}. News Pulse may verify identity before processing requests to protect users, prevent misuse, and confirm that the request is authorised.`,
    ],
  },
  {
    title: '5. Retention and Deletion Requests',
    body: [
      'Submitting a privacy or deletion request does not guarantee automatic deletion. News Pulse may review each request on its facts and may retain information where required for legal, security, editorial, audit, record-keeping, or compliance reasons.',
      'News Pulse may also retain limited records necessary to document request handling, protect the platform, prevent abuse, or comply with lawful obligations.',
    ],
  },
  {
    title: '6. Cookies and Analytics',
    body: [
      'News Pulse may use cookies, analytics tools, or similar technologies to understand website usage, improve performance, measure audience engagement, and support advertising features where enabled.',
      'Users may manage or disable cookies through their browser settings. Some website features may not work properly if cookies are disabled.',
    ],
  },
  {
    title: '7. Data Protection and Security',
    body: [
      'News Pulse aims to use reasonable safeguards to protect information submitted through the website. However, no online system can be guaranteed to be completely secure.',
      'Users should avoid sending sensitive personal information unless it is necessary for the specific purpose of communication or complaint handling.',
    ],
  },
  {
    title: '8. User Submissions',
    body: [
      'When users submit news tips, photos, videos, local updates, or story ideas, News Pulse may review the submitted material for accuracy, legality, safety, relevance, and editorial suitability.',
      'Submission does not guarantee publication. News Pulse may edit, reject, hold, or remove submitted content if it is misleading, unsafe, copied, defamatory, promotional, hateful, illegal, or against our policies.',
    ],
  },
  {
    title: '9. Children’s Privacy',
    body: [
      'News Pulse does not knowingly collect personal information from children without appropriate permission. Content involving children, minors, or sensitive matters is handled with extra care.',
    ],
  },
  {
    title: '10. Third-Party Links',
    body: [
      'News Pulse may contain links to third-party websites, social media platforms, embedded content, or advertising services. News Pulse is not responsible for the privacy practices, content, or policies of third-party websites.',
      'Users should review the privacy policies of third-party websites before sharing personal information with them.',
    ],
  },
  {
    title: '11. Updates to This Policy',
    body: [
      'News Pulse may update this Privacy Policy from time to time to reflect changes in website features, legal requirements, technology, or internal practices.',
      'The latest version will be available on the News Pulse website.',
    ],
  },
  {
    title: '12. Contact for Privacy Concerns',
    body: [
      'For privacy-related questions, access requests, correction requests, deletion requests, withdrawal of consent, grievance requests, nomination requests, or other data concerns, users should contact News Pulse through the published privacy channel.',
      'Privacy / DPDP Email: privacy@newspulse.co.in',
      'Identity verification may be requested before processing a request. No automatic deletion is promised.',
      'Website: www.newspulse.co.in',
    ],
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <PublicBusinessPageLayout
      title="Privacy Policy"
      description="The News Pulse privacy policy explains what user information may be collected and how public inquiries can be made."
      contactEmail={contactEmail}
      contactHref={`mailto:${contactEmail}`}
      contactAriaLabel="Contact News Pulse about privacy"
      contactTitle="Contact News Pulse about privacy"
      tone="slate"
    >
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="min-w-0 sm:p-10">
          <PageEyebrow tone="slate">User privacy information</PageEyebrow>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Privacy Policy
          </h1>
          <div className="mt-4 text-lg font-semibold text-slate-800 sm:text-[1.3rem]">Your privacy matters to News Pulse.</div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            News Pulse respects your privacy and aims to collect only the information needed to respond, improve the website, protect users, and handle lawful requests. This policy is the main public News Pulse privacy and DPDP information page. It explains what information may be collected, how it may be used, what rights users may exercise, and how privacy requests should be submitted.
          </p>
          <div className="mt-5 text-sm text-slate-600">
            <div>Last Updated: 18 June 2026</div>
            <div className="mt-1">Website: www.newspulse.co.in</div>
          </div>
        </SurfacePanel>

        <SurfacePanel className="min-w-0 bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Privacy summary</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Public privacy standards</div>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Only limited user information may be collected through public site interactions and direct submissions.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Submitted information may be used to respond, review, improve site operations, and handle lawful or regulatory needs.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Privacy and DPDP requests should be sent to privacy@newspulse.co.in and may require identity verification before review.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {trustCards.map(({ title, body, Icon }) => (
          <SurfacePanel key={title} className="min-w-0 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {policySections.map((section) => (
          <SurfacePanel key={section.title} className="min-w-0">
            <SectionHeading title={section.title} />
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {section.title === '12. Contact for Privacy Concerns' ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Email Privacy Desk
                </a>
                <Link href="/grievance-redressal" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Grievance Redressal
                </Link>
              </div>
            ) : null}
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8">
        <SurfacePanel className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.99))]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <SectionHeading title="Privacy Contact" kicker="Reader support" />
              <p className="mt-5 text-sm leading-7 text-slate-600">
                For privacy-related questions, access requests, correction requests, deletion requests, withdrawal of consent, grievance requests, nomination requests, or other data concerns, readers should use the published privacy route listed on this page.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.26)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Privacy / DPDP Email</div>
              <div className="mt-3 text-lg font-black tracking-tight text-slate-950">News Pulse</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">Users can reach News Pulse through published privacy, grievance, and contact channels for public-facing concerns.</p>
              <div className="mt-4 text-sm font-semibold text-slate-700">Email: {contactEmail}</div>
            </div>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}