import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PrivacyRequestPage from '../../pages/privacy-request';

describe('pages/privacy-request', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
  });

  it('validates required fields before submitting', async () => {
    render(<PrivacyRequestPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit Privacy Request' }));

    expect(await screen.findByText('Please enter your full name.')).toBeTruthy();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('submits the privacy request form and shows the success message', async () => {
    render(<PrivacyRequestPage />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Kiran Parmar' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kiran@example.com' } });
    fireEvent.change(screen.getByLabelText('Mobile (optional)'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText('Request type'), { target: { value: 'access' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please share my privacy request details.' } });
    fireEvent.change(screen.getByLabelText('Reference ID (optional)'), { target: { value: 'ABC-123' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Privacy Request' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        '/api/privacy/request',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        })
      );
    });

    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      fullName: 'Kiran Parmar',
      email: 'kiran@example.com',
      mobile: '9876543210',
      requestType: 'access',
      message: 'Please share my privacy request details.',
      referenceId: 'ABC-123',
    });

    expect(await screen.findByText('Your privacy request has been received. Please check your email and verify the request. News Pulse will review verified requests.')).toBeTruthy();
  });

  it('shows the safe error message when submission fails', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    });

    render(<PrivacyRequestPage />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Kiran Parmar' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kiran@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please update my personal data.' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Privacy Request' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('We could not submit your request right now. Please try again or email privacy@newspulse.co.in.')).toBeTruthy();
  });
});