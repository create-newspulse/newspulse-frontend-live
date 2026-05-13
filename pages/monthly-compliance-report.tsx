import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileCheck2, Globe, Landmark, ShieldCheck } from 'lucide-react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';
import {
  getPublishedMonthlyComplianceReports,
  monthlyComplianceReports,
  resolveMonthlyComplianceReports,
} from '../data/monthlyComplianceReports';
import { usePublicComplianceSettings } from '../hooks/usePublicComplianceSettings';

const contactHref = '/grievance-redressal';
const contactAriaLabel = 'Visit Grievance Redressal page';
const contactTitle = 'Visit Grievance Redressal page';
const publicGrievanceEmail = 'grievance@newspulse.co.in';
const publicWebsiteUrl = 'https://www.newspulse.co.in';
const publicWebsiteLabel = 'www.newspulse.co.in';

function getReportingMonth(report: { month: string; year: number; label: string }): string {
  if (report.month && report.year > 0) return `${report.month} ${report.year}`;
  return String(report.label || '').replace(/\s+Compliance Report\s*$/i, '').trim();
}

export default function MonthlyComplianceReportPage() {
  const [reports, setReports] = useState(() => getPublishedMonthlyComplianceReports(monthlyComplianceReports));
  const { settings: complianceSettings } = usePublicComplianceSettings();

  useEffect(() => {
    let isActive = true;

    async function loadReports() {
      try {
        const response = await fetch('/api/public/compliance-reports', {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) return;

        const json = await response.json().catch(() => null);
        const nextReports = resolveMonthlyComplianceReports(json, monthlyComplianceReports);

        if (isActive && nextReports.length > 0) {
          setReports(nextReports);
        }
      } catch {
        // Keep static fallback data on fetch failure.
      }
    }

    loadReports();

    return () => {
      isActive = false;
    };
  }, []);

  const publishedReports = reports;
  const contactEmail = publicGrievanceEmail;
  const websiteUrl = publicWebsiteUrl;
  const websiteLabel = publicWebsiteLabel;
  const entityName = complianceSettings.publisherEntity;

  const latestReport = publishedReports[0] ?? monthlyComplianceReports[0];

  if (!latestReport) {
    return (
      <PublicBusinessPageLayout
        title="Monthly Compliance Report"
        description="Monthly compliance disclosure published by News Pulse Media under Rule 18(3) and Rule 19 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021."
        contactEmail={contactEmail}
        contactHref={contactHref}
        contactAriaLabel={contactAriaLabel}
        contactTitle={contactTitle}
        tone="slate"
      >
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
          <SurfacePanel className="sm:p-10">
            <PageEyebrow tone="slate">Public disclosure and legal compliance</PageEyebrow>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
              Monthly Compliance Report
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
              Monthly compliance disclosure under Rule 18(3) and Rule 19 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
            </p>
            <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-5 py-5 text-sm leading-7 text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              Monthly compliance report is temporarily unavailable.
            </div>
          </SurfacePanel>

          <SurfacePanel className="bg-slate-950 text-white">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Disclosure standard</div>
            <div className="mt-2 text-2xl font-black tracking-tight">Public compliance snapshot</div>
            <p className="mt-5 text-sm leading-7 text-white/72">
              This page is published for legal transparency, public disclosure, and internal compliance record keeping for the stated reporting month.
            </p>
          </SurfacePanel>
        </section>
      </PublicBusinessPageLayout>
    );
  }

  const reportingMonth = getReportingMonth(latestReport);

  const complianceRows = [
    {
      description: '1. Total grievances received during this month',
      value: latestReport.complaintsReceived,
    },
    {
      description: '2. Grievances resolved',
      value: latestReport.complaintsResolved,
    },
    {
      description: '3. Average response time',
      value: latestReport.averageResponseTime,
    },
    {
      description: '4. Grievances pending',
      value: latestReport.complaintsPending,
    },
    {
      description: '5. Action taken on orders/directions',
      value: latestReport.actionTakenOnOrders,
    },
  ] as const;

  return (
    <PublicBusinessPageLayout
      title="Monthly Compliance Report"
      description="Monthly compliance disclosure published by News Pulse Media under Rule 18(3) and Rule 19 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021."
      contactEmail={contactEmail}
      contactHref={contactHref}
      contactAriaLabel={contactAriaLabel}
      contactTitle={contactTitle}
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <SurfacePanel className="sm:p-10">
          <PageEyebrow tone="slate">Public disclosure and legal compliance</PageEyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Monthly Compliance Report
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-[17px]">
            Monthly compliance disclosure under Rule 18(3) and Rule 19 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
          </p>
          <div className="mt-4 text-sm font-medium text-slate-500">Last Updated: {latestReport.publishedDate}</div>
          <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1.2fr)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Portal Name</div>
              <div className="mt-2 text-base font-black tracking-tight text-slate-950">{entityName}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Website</div>
              <a
                href={websiteUrl}
                className="mt-2 block max-w-full text-slate-950 underline-offset-4 hover:underline"
                style={{
                  fontSize: 'clamp(14px, 1.1vw, 18px)',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                }}
              >
                <span className="inline-block max-w-full font-black tracking-tight align-top">{websiteLabel}</span>
              </a>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Month &amp; Year</div>
              <div className="mt-2 text-base font-black tracking-tight text-slate-950">{reportingMonth}</div>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel className="bg-slate-950 text-white">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Disclosure standard</div>
          <div className="mt-2 text-2xl font-black tracking-tight">Public compliance snapshot</div>
          <p className="mt-5 text-sm leading-7 text-white/72">
            This page is published for legal transparency, public disclosure, and internal compliance record keeping for the stated reporting month.
          </p>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/80">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">No complainant personal data is disclosed on this page.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">No complainant personal data, contact details, or private complaint information is published on this page.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">All figures shown below relate only to the reporting month of {reportingMonth}.</div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[
          { icon: FileCheck2, title: 'Reporting Basis', body: 'Monthly compliance disclosure under Rule 18(3) and Rule 19 of the IT Rules, 2021.' },
          { icon: Landmark, title: 'Publication Status', body: 'Published for public disclosure and internal compliance record.' },
          { icon: Globe, title: 'Public Website', body: `Accessible on the official News Pulse website for ${reportingMonth} reporting.` },
          { icon: ShieldCheck, title: 'Disclosure Standard', body: 'Prepared in a public-facing compliance format with only summary-level grievance reporting.' },
        ].map((item) => (
          <SurfacePanel key={item.title} className="p-5">
            <item.icon className="h-6 w-6 text-slate-700" />
            <div className="mt-4 text-lg font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
          </SurfacePanel>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <SurfacePanel>
          <SectionHeading
            title="Monthly disclosure table"
            description="Status summary for the reporting month published in a clean, public-facing compliance format."
            kicker="Rule 18(3) / Rule 19"
          />
          <div className="mt-6 overflow-x-auto rounded-[28px] border border-slate-200/80 bg-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th scope="col" className="px-5 py-4 text-sm font-black tracking-[0.02em]">Description</th>
                  <th scope="col" className="px-5 py-4 text-sm font-black tracking-[0.02em]">Number / Status</th>
                </tr>
              </thead>
              <tbody>
                {complianceRows.map((row) => (
                  <tr key={row.description} className="border-t border-slate-200/80 align-top even:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm leading-7 text-slate-700">{row.description}</td>
                    <td className="px-5 py-4 text-sm font-semibold leading-7 text-slate-950">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfacePanel>

        <SurfacePanel className="border-slate-300/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
          <SectionHeading
            title="Note"
            description={`${latestReport.note} This report is published for public disclosure and internal compliance record.`}
            kicker="Reporting note"
          />
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-5 py-5 text-sm leading-7 text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
              The figures above are limited to the monthly compliance disclosure for {reportingMonth} and are presented only as summary-level public reporting.
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-5 text-sm leading-7 text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.18)]">
              This page displays the latest published monthly compliance report. Previous report copies are maintained in internal compliance records.
            </div>
            <div className="rounded-[24px] border border-slate-700/80 bg-slate-950 px-5 py-5 text-sm font-medium leading-7 text-white shadow-[0_22px_44px_-34px_rgba(15,23,42,0.46)]">
              Do not publish personal data of complainants or private complaint details on the public website.
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8">
        <SurfacePanel className="bg-slate-950 text-white">
          <div className="max-w-3xl">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/75">Related legal page</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Grievance submission</h2>
            <p className="mt-3 text-sm leading-7 text-white/88">For grievance submission details, visit Grievance Redressal.</p>
          </div>
          <div className="mt-6">
            <Link
              href="/grievance-redressal"
              className="inline-flex items-center rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Go to Grievance Redressal
            </Link>
          </div>
        </SurfacePanel>
      </section>
    </PublicBusinessPageLayout>
  );
}