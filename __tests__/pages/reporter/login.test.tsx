import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReporterLoginPage from '../../../pages/reporter/login';

const routerState = {
  query: {},
  push: jest.fn().mockResolvedValue(true),
  replace: jest.fn().mockResolvedValue(true),
};

const fetchPublicSettingsMock = jest.fn();
const loadReporterPortalProfileMock = jest.fn();
const saveReporterPortalProfileMock = jest.fn();

jest.mock('../../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({
    toggles: {
      communityReporterClosed: false,
      reporterPortalClosed: false,
    },
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('../../../hooks/useReporterPortalSession', () => ({
  useReporterPortalSession: () => ({
    session: null,
    reason: null,
    isReady: true,
    logout: jest.fn(),
  }),
}));

jest.mock('../../../lib/communityReporterApi', () => ({
  fetchPublicSettings: (...args: any[]) => fetchPublicSettingsMock(...args),
}));

jest.mock('../../../lib/reporterPortal', () => ({
  normalizeReporterEmail: (value: string) => String(value || '').trim().toLowerCase(),
  extractReporterIdentityFields: (value: any, fallbackEmail?: string) => ({
    ...(typeof value?.fullName === 'string' && value.fullName.trim() ? { fullName: value.fullName.trim() } : {}),
    ...(typeof value?.name === 'string' && value.name.trim() ? { name: value.name.trim() } : {}),
    ...(typeof value?.firstName === 'string' && value.firstName.trim() ? { firstName: value.firstName.trim() } : {}),
    email: String(value?.email || fallbackEmail || '').trim().toLowerCase(),
  }),
  loadReporterPortalProfile: (...args: any[]) => loadReporterPortalProfileMock(...args),
  saveReporterPortalProfile: (...args: any[]) => saveReporterPortalProfileMock(...args),
}));

jest.mock('../../../components/reporter-portal/ReporterPortalLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('pages/reporter/login', () => {
  beforeEach(() => {
    fetchPublicSettingsMock.mockResolvedValue({
      communityReporterEnabled: true,
      allowMyStoriesPortal: true,
    });
    loadReporterPortalProfileMock.mockReturnValue(null);
    saveReporterPortalProfileMock.mockReset();
    routerState.query = {};
    routerState.push.mockClear();
    routerState.replace.mockClear();
    (global as any).fetch = jest.fn();
  });

  it('shows the secure reporter email verification form', async () => {
    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(await screen.findByText('Login to Reporter Portal')).toBeTruthy();
    expect(screen.getByLabelText('Reporter email')).toBeTruthy();
    expect(screen.getByText('Send verification code')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('requests a verification code and advances to the code step', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        expiresAt: '2025-01-01T10:30:00.000Z',
        debugCode: '123456',
      }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'Reporter@Example.com ' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        'http://localhost/api/reporter-auth/request-code',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
    expect(screen.getByText('Verification code sent. Check your email for the code or secure sign-in link.')).toBeTruthy();
    expect(screen.getByText('Development code: 123456')).toBeTruthy();
    expect(saveReporterPortalProfileMock).toHaveBeenCalledWith({ email: 'reporter@example.com' });
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('does not fire a second bootstrap request after request-code succeeds', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        expiresAt: '2025-01-01T10:30:00.000Z',
        debugCode: '123456',
      }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
    expect(screen.getByText('Verification code sent. Check your email for the code or secure sign-in link.')).toBeTruthy();
    expect(saveReporterPortalProfileMock).toHaveBeenCalledWith({ email: 'reporter@example.com' });
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('treats 200 ok true as success even when the response includes a non-empty message field', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        message: 'OTP sent successfully',
        expiresAt: '2025-01-01T10:30:00.000Z',
        debugCode: '123456',
      }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
    expect(screen.queryByText('Verification email is temporarily unavailable. Please try again shortly.')).toBeNull();
    expect(screen.getByText('Verification code sent. Check your email for the code or secure sign-in link.')).toBeTruthy();
  });

  it('keeps the user on the email step and shows a mailer outage message when request-code returns 503', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, code: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    await screen.findByText('REPORTER_PORTAL_EMAIL_SEND_FAILED');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect((screen.getByLabelText('Reporter email') as HTMLInputElement).value).toBe('reporter@example.com');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the user on the email step and preserves the email when request-code throws', async () => {
    (global as any).fetch.mockRejectedValueOnce(new Error('network down'));

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    await screen.findByText('Verification email is temporarily unavailable. Please try again shortly.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect((screen.getByLabelText('Reporter email') as HTMLInputElement).value).toBe('reporter@example.com');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the user on the email step and shows the mailer outage message when request-code returns 504', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 504,
      json: async () => ({ ok: false, code: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    await screen.findByText('REPORTER_PORTAL_EMAIL_SEND_FAILED');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('keeps the user on the email step and shows the cooldown message when request-code returns 429', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, code: 'RATE_LIMITED' }),
    });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    await screen.findByText('Please wait a moment before requesting another verification code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate request-code submissions while loading', async () => {
    let resolveRequest: ((value: any) => void) | null = null;
    (global as any).fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });

    const submitButton = screen.getByText('Send verification code');
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledTimes(1);
    });

    resolveRequest?.({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        expiresAt: '2025-01-01T10:30:00.000Z',
        debugCode: '123456',
      }),
    });

    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
  });

  it('resend resets the OTP input and tells the user to use the latest code only', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '111111' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:35:00.000Z', debugCode: '222222' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'Reporter@Example.com ' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    const codeInput = await screen.findByLabelText('Verification code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    expect((codeInput as HTMLInputElement).value).toBe('123456');

    fireEvent.click(screen.getByText('Resend'));

    await screen.findByText('A new verification code was sent. Use the most recent code only.');
    expect((screen.getByLabelText('Verification code') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Development code: 222222')).toBeTruthy();

    expect((global as any).fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost/api/reporter-auth/request-code',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'reporter@example.com' }),
      })
    );
  });

  it('resets to email entry and clears stale OTP state when resend request-code fails with 503', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '111111' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ ok: false, code: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    const codeInput = await screen.findByLabelText('Verification code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Resend'));

    await screen.findByText('REPORTER_PORTAL_EMAIL_SEND_FAILED');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect((screen.getByLabelText('Reporter email') as HTMLInputElement).value).toBe('reporter@example.com');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('verifies using the latest active challenge email and shows newer-code messaging after resend', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '111111' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:35:00.000Z', debugCode: '222222' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:35:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, code: 'OTP_REPLACED_BY_NEWER_CODE' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'Reporter@Example.com ' },
    });
    fireEvent.click(screen.getByText('Send verification code'));
    await screen.findByLabelText('Verification code');

    fireEvent.click(screen.getByText('Resend'));
    await screen.findByText('A new verification code was sent. Use the most recent code only.');

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('A newer verification code was sent. Use the most recent code only.');
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      4,
      'http://localhost/api/reporter-auth/verify-code',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'reporter@example.com', code: '111111' }),
      })
    );
  });

  it('shows an incorrect-code message after resend when the OTP is wrong but not explicitly replaced', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '111111' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:35:00.000Z', debugCode: '222222' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:35:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, code: 'OTP_INVALID', attemptsRemaining: 2 }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'Reporter@Example.com ' },
    });
    fireEvent.click(screen.getByText('Send verification code'));
    await screen.findByLabelText('Verification code');

    fireEvent.click(screen.getByText('Resend'));
    await screen.findByText('A new verification code was sent. Use the most recent code only.');

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '333333' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('That verification code is incorrect. Attempts remaining: 2.');
    expect(screen.queryByText('A newer verification code was sent. Use the most recent code only.')).toBeNull();
    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
  });

  it('stores the verified reporter full name when verify-code returns identity fields', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, email: 'reporter@example.com', fullName: 'Kiran Parmar', firstName: 'Kiran' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify code'));

    await waitFor(() => {
      expect(routerState.push).toHaveBeenCalledWith('/reporter/dashboard');
    });

    expect(saveReporterPortalProfileMock).toHaveBeenLastCalledWith({
      email: 'reporter@example.com',
      fullName: 'Kiran Parmar',
      firstName: 'Kiran',
    });
  });

  it('shows a specific expired-code message and returns to the email step', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, code: 'OTP_EXPIRED_OR_MISSING' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('This verification code expired. Request a fresh code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
  });

  it('resets cleanly when verify returns an expired verification session', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'REPORTER_SESSION_MISSING' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Your verification session expired. Request a new code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect((global as any).fetch).toHaveBeenCalledTimes(3);
  });

  it('resets cleanly when verify returns a session-related 500 response', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'REPORTER_SESSION_MISSING' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Your verification session expired. Request a new code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect((global as any).fetch).toHaveBeenCalledTimes(3);
  });

  it('resets to email step when the latest challenge session is missing before verify', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Your verification session expired. Request a new code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('shows a specific too-many-attempts message and resets to email step', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, code: 'OTP_INVALID', attemptsRemaining: 0 }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Too many incorrect attempts. Request a fresh code.');
    expect(await screen.findByLabelText('Reporter email')).toBeTruthy();
  });

  it('shows a specific server-error message when verification is temporarily unavailable', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ ok: false, code: 'REPORTER_VERIFY_CODE_FAILED' }),
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Verification is temporarily unavailable. Try again shortly.');
    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
  });

  it('shows the server-error message instead of a generic verify error for a bare 500 response', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => null,
      });

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify code'));

    await screen.findByText('Verification is temporarily unavailable. Try again shortly.');
    expect(screen.queryByText('Could not verify this code.')).toBeNull();
  });

  it('prevents duplicate request-code submissions while a send is pending', async () => {
    let resolveRequestCode: ((value: any) => void) | null = null;
    (global as any).fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequestCode = resolve;
    }));

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });

    const submitButton = screen.getByText('Send verification code');
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledTimes(1);
    });

    resolveRequestCode?.({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, code: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' }),
    });

    await screen.findByText('REPORTER_PORTAL_EMAIL_SEND_FAILED');
  });

  it('prevents duplicate verify submissions while verification is pending', async () => {
    let resolveVerifyCode: ((value: any) => void) | null = null;
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, expiresAt: '2025-01-01T10:30:00.000Z', debugCode: '123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, challenge: { email: 'reporter@example.com', expiresAt: '2025-01-01T10:30:00.000Z' } }),
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveVerifyCode = resolve;
      }));

    render(<ReporterLoginPage communityReporterClosed={false} reporterPortalClosed={false} />);

    fireEvent.change(await screen.findByLabelText('Reporter email'), {
      target: { value: 'reporter@example.com' },
    });
    fireEvent.click(screen.getByText('Send verification code'));

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });

    const verifyButton = screen.getByText('Verify code');
    fireEvent.click(verifyButton);
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledTimes(3);
    });

    resolveVerifyCode?.({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, code: 'REPORTER_VERIFY_CODE_FAILED' }),
    });

    await screen.findByText('Verification is temporarily unavailable. Try again shortly.');
  });
});