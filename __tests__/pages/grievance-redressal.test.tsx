import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GrievanceRedressalPage from '../../pages/grievance-redressal';

describe('pages/grievance-redressal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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

  it('shows the official grievance details and CTA while keeping the form hidden on initial load', () => {
    render(<GrievanceRedressalPage />);

    expect(screen.getByRole('heading', { name: 'Grievance Redressal' })).toBeTruthy();
    expect(
      screen.getByText('News Pulse is committed to responsible publishing, transparency, and timely resolution of valid complaints related to content, corrections, copyright, privacy, or legal concerns.')
    ).toBeTruthy();

    expect(screen.getAllByText('Kiran Parmar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('News Pulse Media').length).toBeGreaterThan(0);
    expect(screen.getAllByText('www.newspulse.co.in').length).toBeGreaterThan(0);

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

  it('opens, smooth-scrolls to, and focuses the grievance form when the CTA is clicked', () => {
    render(<GrievanceRedressalPage />);

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

    fireEvent.click(screen.getByRole('link', { name: 'Email the News Pulse grievance officer' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(fullNameInput);
  });

  it('submits the grievance form and shows the success state', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    render(<GrievanceRedressalPage />);

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
});