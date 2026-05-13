export type MonthlyComplianceReport = {
  month: string;
  year: number;
  label: string;
  publishedDate: string;
  complaintsReceived: number;
  complaintsResolved: number;
  averageResponseTime: string;
  complaintsPending: number;
  actionTakenOnOrders: string;
  note: string;
  status: "Published" | "Draft";
};

const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveMonthLabel(month: string, year: number, label: string): string {
  if (label) return label;
  if (month && year > 0) return `${month} ${year}`;
  return '';
}

function normalizeStatus(value: unknown): 'Published' | 'Draft' {
  return String(value || '').trim().toLowerCase() === 'published' ? 'Published' : 'Draft';
}

export function normalizeMonthlyComplianceReport(report: any): MonthlyComplianceReport | null {
  if (!report || typeof report !== 'object') return null;

  const month = normalizeText(report.month);
  const year = normalizeNumber(report.year);
  const label = resolveMonthLabel(month, year, normalizeText(report.label));
  const publishedDate = normalizeText(report.publishedDate);

  if (!label || !publishedDate) return null;

  return {
    month,
    year,
    label,
    publishedDate,
    complaintsReceived: normalizeNumber(report.complaintsReceived),
    complaintsResolved: normalizeNumber(report.complaintsResolved),
    averageResponseTime: normalizeText(report.averageResponseTime) || 'Nil',
    complaintsPending: normalizeNumber(report.complaintsPending),
    actionTakenOnOrders: normalizeText(report.actionTakenOnOrders) || 'Nil',
    note: normalizeText(report.note),
    status: normalizeStatus(report.status),
  };
}

function getPayloadReports(payload: any): any[] {
  return Array.isArray(payload) ? payload :
    Array.isArray(payload?.reports) ? payload.reports :
    Array.isArray(payload?.items) ? payload.items :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.data?.reports) ? payload.data.reports :
    Array.isArray(payload?.data?.items) ? payload.data.items :
    [];
}

export function getMonthlyComplianceReportSortValue(report: MonthlyComplianceReport): number {
  const monthIndex = monthOrder.indexOf(report.month as (typeof monthOrder)[number]);
  const publishedTime = Date.parse(report.publishedDate);
  return (report.year * 100 + Math.max(monthIndex, 0)) * 1_000_000 + (Number.isNaN(publishedTime) ? 0 : publishedTime);
}

export function getPublishedMonthlyComplianceReports(reports: MonthlyComplianceReport[]): MonthlyComplianceReport[] {
  return [...reports]
    .filter((report) => report.status === 'Published')
    .sort((left, right) => getMonthlyComplianceReportSortValue(right) - getMonthlyComplianceReportSortValue(left));
}

export function resolveMonthlyComplianceReports(
  payload: any,
  fallbackReports: MonthlyComplianceReport[] = monthlyComplianceReports
): MonthlyComplianceReport[] {
  const normalized = getPayloadReports(payload)
    .map((report) => normalizeMonthlyComplianceReport(report))
    .filter((report): report is MonthlyComplianceReport => Boolean(report));

  const published = getPublishedMonthlyComplianceReports(normalized);
  return published.length > 0 ? published : getPublishedMonthlyComplianceReports(fallbackReports);
}

export const monthlyComplianceReports: MonthlyComplianceReport[] = [
  {
    month: "April",
    year: 2026,
    label: "April 2026",
    publishedDate: "12 May 2026",
    complaintsReceived: 0,
    complaintsResolved: 0,
    averageResponseTime: "Nil",
    complaintsPending: 0,
    actionTakenOnOrders: "Nil",
    note: "No grievances were received during this reporting month.",
    status: "Published",
  },
];