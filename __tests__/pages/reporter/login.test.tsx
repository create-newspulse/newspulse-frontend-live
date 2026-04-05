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
  });
});