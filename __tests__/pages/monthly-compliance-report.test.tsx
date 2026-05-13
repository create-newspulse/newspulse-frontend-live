import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import MonthlyComplianceReportPage from '../../pages/monthly-compliance-report';

jest.mock('../../data/monthlyComplianceReports', () => ({
  __esModule: true,
  getPublishedMonthlyComplianceReports: (reports: any[]) =>
    [...reports]
      .filter((report) => report.status === 'Published')
      .sort((left, right) => Date.parse(right.publishedDate) - Date.parse(left.publishedDate)),
  resolveMonthlyComplianceReports: (payload: any, fallbackReports: any[]) => {
    const reports = Array.isArray(payload?.reports) ? payload.reports : fallbackReports;
    const published = reports.filter((report: any) => report.status === 'Published');
    return published.length > 0
      ? [...published].sort((left: any, right: any) => Date.parse(right.publishedDate) - Date.parse(left.publishedDate))
      : [...fallbackReports].filter((report: any) => report.status === 'Published');
  },
  monthlyComplianceReports: [
    {
      month: 'April',
      year: 2026,
      label: 'April 2026',
      publishedDate: '12 May 2026',
      complaintsReceived: 0,
      complaintsResolved: 0,
      averageResponseTime: 'Nil',
      complaintsPending: 0,
      actionTakenOnOrders: 'Nil',
      note: 'No grievances were received during this reporting month.',
      status: 'Published',
    },
    {
      month: 'March',
      year: 2026,
      label: 'March 2026',
      publishedDate: '10 April 2026',
      complaintsReceived: 2,
      complaintsResolved: 2,
      averageResponseTime: '3 days',
      complaintsPending: 0,
      actionTakenOnOrders: 'Nil',
      note: 'Historical report should not appear in the public archive right now.',
      status: 'Draft',
    },
    {
      month: 'May',
      year: 2026,
      label: 'May 2026',
      publishedDate: '05 June 2026',
      complaintsReceived: 1,
      complaintsResolved: 0,
      averageResponseTime: 'Pending',
      complaintsPending: 1,
      actionTakenOnOrders: 'Under review',
      note: 'Draft data should not appear in the public archive.',
      status: 'Draft',
    },
  ],
}));

import { monthlyComplianceReports as mockedMonthlyComplianceReports } from '../../data/monthlyComplianceReports';

describe('pages/monthly-compliance-report', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith('/api/public/compliance-settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: 'Asha Singh',
              grievanceOfficerDesignation: 'Grievance Officer',
              grievanceEmail: 'grievance@newspulse.co.in',
              location: 'India',
              publisherEntity: 'News Pulse Media',
              websiteUrl: 'https://legal.newspulse.co.in',
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          reports: [
            {
              month: 'April',
              year: 2026,
              label: 'April 2026',
              publishedDate: '12 May 2026',
              complaintsReceived: 0,
              complaintsResolved: 0,
              averageResponseTime: 'Nil',
              complaintsPending: 0,
              actionTakenOnOrders: 'Nil',
              note: 'No grievances were received during this reporting month.',
              status: 'Published',
            },
            {
              month: 'March',
              year: 2026,
              label: 'March 2026',
              publishedDate: '10 April 2026',
              complaintsReceived: 2,
              complaintsResolved: 2,
              averageResponseTime: '3 days',
              complaintsPending: 0,
              actionTakenOnOrders: 'Nil',
              note: 'Historical report should not appear in the public archive right now.',
              status: 'Draft',
            },
            {
              month: 'May',
              year: 2026,
              label: 'May 2026',
              publishedDate: '05 June 2026',
              complaintsReceived: 1,
              complaintsResolved: 0,
              averageResponseTime: 'Pending',
              complaintsPending: 1,
              actionTakenOnOrders: 'Under review',
              note: 'Draft data should not appear in the public archive.',
              status: 'Draft',
            },
          ],
        }),
      };
    });
  });

  it('renders only the latest published report from the public API', async () => {
    const latestReport = mockedMonthlyComplianceReports.find((report) => report.label === 'April 2026');

    render(<MonthlyComplianceReportPage />);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        '/api/public/compliance-reports',
        expect.objectContaining({ method: 'GET' })
      );
    });
    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/public\/compliance-settings\?t=\d+$/),
        expect.objectContaining({ method: 'GET', cache: 'no-store' })
      );
    });
    expect(await screen.findByText('News Pulse Media')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Monthly Compliance Report' })).toBeTruthy();
    expect(screen.getAllByText('News Pulse Media').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Visit Grievance Redressal page' }).getAttribute('href')).toBe('/grievance-redressal');
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'www.newspulse.co.in' }).getAttribute('href')).toBe('https://www.newspulse.co.in');
    expect(screen.getAllByText(latestReport?.label || '').length).toBeGreaterThan(0);
    expect(screen.getByText('Month & Year')).toBeTruthy();
    expect(screen.getByText('April 2026')).toBeTruthy();
    expect(screen.getByText(`Last Updated: ${latestReport?.publishedDate}`)).toBeTruthy();
    expect(screen.getByText('Monthly compliance disclosure under Rule 18(3) and Rule 19 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.')).toBeTruthy();
    expect(screen.getByText('Accessible on the official News Pulse website for April 2026 reporting.')).toBeTruthy();
    expect(screen.getByText('All figures shown below relate only to the reporting month of April 2026.')).toBeTruthy();

    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Number / Status' })).toBeTruthy();
    expect(screen.getByText('1. Total grievances received during this month')).toBeTruthy();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nil').length).toBeGreaterThan(0);

    expect(screen.getByText(`${latestReport?.note} This report is published for public disclosure and internal compliance record.`)).toBeTruthy();
    expect(screen.getByText('The figures above are limited to the monthly compliance disclosure for April 2026 and are presented only as summary-level public reporting.')).toBeTruthy();
    expect(screen.getByText('This page displays the latest published monthly compliance report. Previous report copies are maintained in internal compliance records.')).toBeTruthy();
    expect(screen.getByText('Do not publish personal data of complainants or private complaint details on the public website.')).toBeTruthy();
    expect(screen.queryByText('Report Archive')).toBeNull();
    expect(screen.queryByText('All published monthly compliance reports are listed here for public record and future reference.')).toBeNull();
    expect(screen.getByText('Publication Status')).toBeTruthy();
    expect(screen.getByText('Published for public disclosure and internal compliance record.')).toBeTruthy();
    expect(screen.queryByText('March 2026')).toBeNull();
    expect(screen.queryByText('May 2026')).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to Grievance Redressal' }).getAttribute('href')).toBe('/grievance-redressal');
  });

  it('uses the newest published report when the public API returns multiple published reports', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        settings: {
          founderName: 'Kiran Parmar',
          grievanceOfficerName: 'Asha Singh',
          grievanceOfficerDesignation: 'Grievance Officer',
          grievanceEmail: 'grievance@newspulse.co.in',
          location: 'India',
          publisherEntity: 'News Pulse Media',
          websiteUrl: 'https://legal.newspulse.co.in',
        },
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reports: [
          {
            month: 'March',
            year: 2026,
            label: 'March 2026',
            publishedDate: '10 April 2026',
            complaintsReceived: 2,
            complaintsResolved: 2,
            averageResponseTime: '3 days',
            complaintsPending: 0,
            actionTakenOnOrders: 'Nil',
            note: 'Older published report.',
            status: 'Published',
          },
          {
            month: 'April',
            year: 2026,
            label: 'April 2026 Compliance Report',
            publishedDate: '13 May 2026',
            complaintsReceived: 0,
            complaintsResolved: 0,
            averageResponseTime: 'Nil',
            complaintsPending: 0,
            actionTakenOnOrders: 'Nil',
            note: 'No grievances were received during this reporting month.',
            status: 'Published',
          },
        ],
      }),
    });

    render(<MonthlyComplianceReportPage />);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
    });
    expect(await screen.findByText('News Pulse Media')).toBeTruthy();

    expect(screen.getAllByText('April 2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Last Updated: 13 May 2026')).toBeTruthy();
    expect(screen.getByText('Accessible on the official News Pulse website for April 2026 reporting.')).toBeTruthy();
    expect(screen.getByText('All figures shown below relate only to the reporting month of April 2026.')).toBeTruthy();
    expect(screen.getByText('The figures above are limited to the monthly compliance disclosure for April 2026 and are presented only as summary-level public reporting.')).toBeTruthy();
    expect(screen.queryByText('Older published report. This report is published for public disclosure and internal compliance record.')).toBeNull();
    expect(screen.queryByText('March 2026')).toBeNull();
    expect(screen.queryByText('All figures shown below relate only to the reporting month of April 2026 Compliance Report.')).toBeNull();
    expect(screen.getByText('Published for public disclosure and internal compliance record.')).toBeTruthy();
  });

  it('keeps the static fallback report when the public compliance API fails', async () => {
    (global as any).fetch = jest.fn()
      .mockRejectedValueOnce(new Error('settings down'))
      .mockRejectedValueOnce(new Error('network down'));

    render(<MonthlyComplianceReportPage />);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
    });

    expect(screen.getAllByText('April 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('News Pulse Media').length).toBeGreaterThan(0);
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'www.newspulse.co.in' }).getAttribute('href')).toBe('https://www.newspulse.co.in');
    expect(screen.getByText('This page displays the latest published monthly compliance report. Previous report copies are maintained in internal compliance records.')).toBeTruthy();
    expect(screen.getByText('Published for public disclosure and internal compliance record.')).toBeTruthy();
    expect(screen.queryByText('Report Archive')).toBeNull();
  });

  it('polls compliance settings every 30 seconds and updates public email display without refreshing the page', async () => {
    jest.useFakeTimers();

    let complianceFetchCount = 0;
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith('/api/public/compliance-settings')) {
        complianceFetchCount += 1;

        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: 'Asha Singh',
              grievanceOfficerDesignation: 'Grievance Officer',
              grievanceEmail: complianceFetchCount === 1 ? 'grievance@newspulse.co.in' : 'legaldesk@newspulse.co.in',
              location: 'India',
              publisherEntity: 'News Pulse Media',
              websiteUrl: 'https://legal.newspulse.co.in',
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          reports: [
            {
              month: 'April',
              year: 2026,
              label: 'April 2026',
              publishedDate: '12 May 2026',
              complaintsReceived: 0,
              complaintsResolved: 0,
              averageResponseTime: 'Nil',
              complaintsPending: 0,
              actionTakenOnOrders: 'Nil',
              note: 'No grievances were received during this reporting month.',
              status: 'Published',
            },
          ],
        }),
      };
    });

    await act(async () => {
      render(<MonthlyComplianceReportPage />);
      await Promise.resolve();
    });

    expect(await screen.findByText('News Pulse Media')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'www.newspulse.co.in' })).toBeTruthy();
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    });
  });
});