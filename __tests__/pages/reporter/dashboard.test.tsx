import React from 'react';
import { render, screen } from '@testing-library/react';
import ReporterDashboardPage from '../../../pages/reporter/dashboard';

const routerState = {
  push: jest.fn().mockResolvedValue(true),
};

const useCommunityStoriesMock = jest.fn();
const useReporterPortalSessionMock = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('../../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({
    toggles: {
      communityReporterClosed: false,
      reporterPortalClosed: false,
    },
  }),
}));

jest.mock('../../../hooks/useCommunityStories', () => ({
  useCommunityStories: (...args: any[]) => useCommunityStoriesMock(...args),
}));

jest.mock('../../../hooks/useReporterPortalSession', () => ({
  useReporterPortalSession: (...args: any[]) => useReporterPortalSessionMock(...args),
}));

jest.mock('../../../components/reporter-portal/ReporterPortalLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../../components/reporter-portal/PortalRouteState', () => ({
  PortalRouteState: ({ title, description }: { title: string; description: string }) => <div><div>{title}</div><div>{description}</div></div>,
}));

describe('pages/reporter/dashboard', () => {
  beforeEach(() => {
    routerState.push.mockClear();
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'newspulse.team@gmail.com' },
      isReady: true,
      logout: jest.fn(),
      reason: null,
    });
  });

  it('shows a session error instead of zero stat cards when reporter records fail auth', () => {
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: 'load failed',
      errorStatus: 401,
      hasLoadedOnce: true,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Session expired')).toBeTruthy();
    expect(screen.getByText('Your reporter session could not be confirmed for dashboard activity. Sign in again and retry.')).toBeTruthy();
    expect(screen.queryByText('Total')).toBeNull();
  });

  it('shows actual counts and recent records after a successful fetch', () => {
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [
        { id: '1', headline: 'City update', category: 'Local', status: 'pending', createdAt: '2026-04-05T10:00:00.000Z' },
        { id: '2', headline: 'Campus bulletin', category: 'Education', status: 'approved', createdAt: '2026-04-05T11:00:00.000Z' },
      ],
      counts: { total: 2, pending: 1, approved: 1, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: true,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('City update')).toBeTruthy();
    expect(screen.getByText('Campus bulletin')).toBeTruthy();
  });
});