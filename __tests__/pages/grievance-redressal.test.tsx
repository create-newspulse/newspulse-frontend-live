import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GrievanceRedressalPage from '../../pages/grievance-redressal';

describe('pages/grievance-redressal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/public/compliance-settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: 'Asha Singh',
              grievanceOfficerDesignation: 'Senior Grievance Officer',
              grievanceEmail: 'grievance@newspulse.co.in',
              grievanceOfficerLocation: 'India',
              chiefEditorName: 'Shailesh Rathod',
              publisherEntity: 'News Pulse Media',
              websiteUrl: 'https://www.newspulse.co.in',
              showPublisherEntity: true,
              showFounderPublisher: true,
              showChiefEditor: true,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the official grievance details and CTA while keeping the form hidden on initial load', async () => {
    render(<GrievanceRedressalPage />);
    expect(await screen.findByText('Asha Singh')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Grievance Redressal' })).toBeTruthy();
    expect(
      screen.getByText('News Pulse is committed to responsible publishing, transparency, and timely resolution of valid complaints related to content, corrections, copyright, privacy, or legal concerns.')
    ).toBeTruthy();

    expect(screen.getAllByText('News Pulse Media').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kiran Parmar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Asha Singh').length).toBeGreaterThan(0);
    expect(screen.queryByText('Senior Grievance Officer')).toBeNull();
    expect(screen.getAllByText('India').length).toBeGreaterThan(0);
    expect(screen.getByText('Official Grievance Email')).toBeTruthy();
    expect(screen.getByText('Chief Editor')).toBeTruthy();
    expect(screen.getAllByText('Shailesh Rathod').length).toBeGreaterThan(0);
    expect(screen.queryByText('Response Timeline')).toBeNull();
    expect(screen.queryByText('Designation')).toBeNull();

    const cardTitles = screen.getAllByText(
      /^(Publisher \/ Entity|Founder \/ Publisher|Chief Editor|Grievance Officer|Official Grievance Email|Location)$/
    ).map((node) => node.textContent);
    expect(cardTitles.slice(0, 6)).toEqual([
      'Publisher / Entity',
      'Founder / Publisher',
      'Chief Editor',
      'Grievance Officer',
      'Official Grievance Email',
      'Location',
    ]);

    expect(screen.queryByLabelText('Full Name')).toBeNull();
    expect(screen.queryByLabelText('Email Address')).toBeNull();
    expect(screen.queryByLabelText('Phone Number')).toBeNull();
    expect(screen.queryByLabelText('Address for communication with PIN Code')).toBeNull();

    expect(
      screen.getAllByText('We will acknowledge valid grievances within 24 hours and aim to resolve them within 15 days, where applicable.').length
    ).toBeGreaterThan(0);

    expect(screen.getAllByRole('link', { name: 'grievance@newspulse.co.in' })[0]?.getAttribute('href')).toBe('#grievance-form');
    expect(screen.getByRole('link', { name: 'Email the News Pulse grievance officer' }).getAttribute('href')).toBe('#grievance-form');
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.queryByText('Official contact details')).toBeNull();
    expect(screen.queryByText('Before you submit')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Submit a grievance' })).toBeNull();
    expect(screen.getByText('Review Process')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('Response timeline')).toBeTruthy();
    expect(document.getElementById('grievance-form')).toBeNull();
  });

  it('opens, smooth-scrolls to, and focuses the grievance form when the CTA is clicked', async () => {
    render(<GrievanceRedressalPage />);
    expect(await screen.findByText('Asha Singh')).toBeTruthy();

    const scrollIntoView = window.HTMLElement.prototype.scrollIntoView as jest.Mock;
    fireEvent.click(screen.getAllByRole('link', { name: 'grievance@newspulse.co.in' })[0]);

    const fullNameInput = screen.getByLabelText('Full Name');

    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(fullNameInput);
    expect(document.getElementById('grievance-form')).toBeTruthy();
    expect(screen.getByText('Grievance Help Desk')).toBeTruthy();
    expect(screen.getByText('How your grievance will be reviewed')).toBeTruthy();
    expect(screen.getByText('Submission received')).toBeTruthy();
    expect(screen.getAllByText('Acknowledgement within 24 hours').length).toBeGreaterThan(0);
    expect(screen.getByText('Editorial review')).toBeTruthy();
    expect(screen.getByText('Decision / action within 15 days, where applicable')).toBeTruthy();
    expect(screen.getByText('Before submitting')).toBeTruthy();
    expect(screen.getByText('Important note')).toBeTruthy();
    expect(screen.getByText('Official contact')).toBeTruthy();
    expect(screen.getByText('Please submit only genuine, complete, and accurate information. Incomplete or unclear grievances may require additional clarification.')).toBeTruthy();
    expect(screen.queryByText('Senior Grievance Officer')).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Email the News Pulse grievance officer' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(fullNameInput);
  });

  it('submits the grievance form and shows the success state', async () => {
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/public/compliance-settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: '',
              grievanceOfficerDesignation: '',
              grievanceEmail: 'grievance@newspulse.co.in',
              grievanceOfficerLocation: 'India',
              chiefEditorName: '',
              publisherEntity: 'News Pulse Media',
              websiteUrl: 'https://www.newspulse.co.in',
              showPublisherEntity: true,
              showChiefEditor: true,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    render(<GrievanceRedressalPage />);
  expect(await screen.findByText('To be appointed / Details will be updated shortly')).toBeTruthy();
    expect(screen.getByText('Chief Editor')).toBeTruthy();
    expect(screen.getByText('Details will be updated shortly')).toBeTruthy();
    expect(screen.getAllByText('Grievance Officer').length).toBeGreaterThan(0);

  fireEvent.click(screen.getAllByRole('link', { name: 'grievance@newspulse.co.in' })[0]);

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Kiran Parmar' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'kiran@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Address for communication with PIN Code'), { target: { value: '123 News Street, Ahmedabad - 380001' } });
    fireEvent.change(screen.getByLabelText('Article/Page URL or headline/content reference'), { target: { value: 'https://www.newspulse.co.in/sample-story' } });
    fireEvent.change(screen.getByLabelText('Date of publication'), { target: { value: '2026-05-10' } });
    fireEvent.change(screen.getByLabelText('Whether the entire publication is violative of the Code of Ethics or any specific part'), { target: { value: 'A specific paragraph is in dispute.' } });
    fireEvent.change(screen.getByLabelText('Detailed summary of how the content violates the Code of Ethics or the specific rule/section'), { target: { value: 'The paragraph contains an alleged factual inaccuracy requiring review.' } });
    fireEvent.click(screen.getByLabelText(/I hereby declare that the information furnished above is true, correct, and complete/i));

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Grievance' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        '/api/public/grievance',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        })
      );
    });

    expect(await screen.findByText('Your grievance has been submitted successfully. Our team will review it as per the applicable timeline.')).toBeTruthy();
  });

  it('hides optional cards based on public visibility settings and keeps required cards visible', async () => {
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/public/compliance-settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: 'Asha Singh',
              grievanceEmail: 'grievance@newspulse.co.in',
              grievanceOfficerLocation: 'India',
              chiefEditorName: 'Shailesh Rathod',
              publisherEntity: 'News Pulse Media',
              showPublisherEntity: false,
              showFounderPublisher: false,
              showChiefEditor: false,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    render(<GrievanceRedressalPage />);
    expect(await screen.findByText('Asha Singh')).toBeTruthy();

    expect(screen.queryByText('Publisher / Entity')).toBeNull();
    expect(screen.queryByText('Founder / Publisher')).toBeNull();
    expect(screen.queryByText('Chief Editor')).toBeNull();
    expect(screen.getByText('Grievance Officer')).toBeTruthy();
    expect(screen.getByText('Official Grievance Email')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
  });

  it('uses fallback visibility defaults when public visibility settings are missing', async () => {
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/public/compliance-settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {
              founderName: 'Kiran Parmar',
              grievanceOfficerName: 'Asha Singh',
              grievanceEmail: 'grievance@newspulse.co.in',
              grievanceOfficerLocation: 'India',
              chiefEditorName: 'Shailesh Rathod',
              publisherEntity: 'News Pulse Media',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    render(<GrievanceRedressalPage />);
    expect(await screen.findByText('Asha Singh')).toBeTruthy();

    expect(screen.getByText('Publisher / Entity')).toBeTruthy();
    expect(screen.queryByText('Founder / Publisher')).toBeNull();
    expect(screen.getByText('Chief Editor')).toBeTruthy();
  });

  it('polls public compliance settings every 5 seconds and updates the displayed cards without reloading', async () => {
    jest.useFakeTimers();

    let complianceFetchCount = 0;
    (global as any).fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/public/compliance-settings')) {
        complianceFetchCount += 1;

        if (complianceFetchCount === 1) {
          return {
            ok: true,
            json: async () => ({
              settings: {
                grievanceOfficerName: 'Asha Singh',
                grievanceEmail: 'grievance@newspulse.co.in',
                grievanceOfficerLocation: 'India',
                publisherEntity: 'News Pulse Media',
                chiefEditorName: 'Shailesh Rathod',
                showPublisherEntity: false,
                showFounderPublisher: false,
                showChiefEditor: false,
              },
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            settings: {
              grievanceOfficerName: 'Asha Singh',
              grievanceEmail: 'updated-grievance@newspulse.co.in',
              grievanceOfficerLocation: 'India',
              publisherEntity: 'Updated News Pulse Media',
              chiefEditorName: 'Updated Editor',
              showPublisherEntity: true,
              showFounderPublisher: false,
              showChiefEditor: true,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    render(<GrievanceRedressalPage />);

    expect(await screen.findByText('Asha Singh')).toBeTruthy();
    expect(screen.queryByText('Publisher / Entity')).toBeNull();
    expect(screen.queryByText('Chief Editor')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(await screen.findByText('Updated News Pulse Media')).toBeTruthy();
    expect(screen.getByText('Chief Editor')).toBeTruthy();
    expect(screen.getByText('Updated Editor')).toBeTruthy();
    expect(screen.getAllByText('updated-grievance@newspulse.co.in').length).toBeGreaterThan(0);
  });
});