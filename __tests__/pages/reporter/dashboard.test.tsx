import React from 'react';
import { render, screen } from '@testing-library/react';
import ReporterDashboardPage from '../../../pages/reporter/dashboard';

const routerState = {
  asPath: '/reporter/dashboard',
  push: jest.fn().mockResolvedValue(true),
  replace: jest.fn().mockResolvedValue(true),
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
    routerState.replace.mockClear();
    routerState.asPath = '/reporter/dashboard';
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'newspulse.team@gmail.com' },
      reporter: { email: 'newspulse.team@gmail.com' },
      authenticated: true,
      status: 'authenticated',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: null,
    });
  });

  it('keeps an authenticated reporter in the dashboard when records fail auth upstream', () => {
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

    expect(routerState.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Dashboard activity is temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeTruthy();
    expect(screen.queryByText('Total')).toBeNull();
  });

  it('does not render authenticated dashboard or start story loading while session is checking', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'cached@example.com' },
      reporter: null,
      authenticated: false,
      profile: null,
      status: 'checking',
      isReady: false,
      loading: true,
      logout: jest.fn(),
      reason: null,
    });
    useCommunityStoriesMock.mockReturnValue({
      settings: null,
      settingsLoading: true,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: false,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Checking reporter session…')).toBeTruthy();
    expect(screen.queryByText('Total')).toBeNull();
    expect(useCommunityStoriesMock).toHaveBeenCalledWith(expect.objectContaining({
      reporterEmail: null,
      reporterAuth: true,
      enabled: false,
    }));
  });

  it('redirects to login when the protected dashboard session is expired', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: null,
      reporter: null,
      authenticated: false,
      profile: null,
      status: 'anonymous',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: 'SESSION_EXPIRED',
    });
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: false,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(useReporterPortalSessionMock).toHaveBeenCalledWith({ reportUnauthorizedReason: true });
    expect(routerState.replace).toHaveBeenCalledWith('/reporter/login?next=%2Freporter%2Fdashboard');
    expect(screen.getByText('Checking reporter session…')).toBeTruthy();
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

  it('renders a valid empty reporter-owned result without the temporary unavailable message', () => {
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: true,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('No submissions linked to this Reporter Portal account yet.')).toBeTruthy();
    expect(screen.queryByText('Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeNull();
  });

  it('renders temporary unavailable for reporter stories API failures', () => {
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, withdrawn: 0 },
      isLoading: false,
      error: 'load failed',
      errorStatus: 500,
      hasLoadedOnce: true,
    });

    render(<ReporterDashboardPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeTruthy();
  });
});