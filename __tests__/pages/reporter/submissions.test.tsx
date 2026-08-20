import React from 'react';
import { render, screen } from '@testing-library/react';
import ReporterSubmissionsPage from '../../../pages/reporter/submissions';

const routerState = {
  asPath: '/reporter/submissions',
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

describe('pages/reporter/submissions', () => {
  beforeEach(() => {
    routerState.asPath = '/reporter/submissions';
    routerState.push.mockClear();
    routerState.replace.mockClear();
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: true,
    });
  });

  it('shows a bounded session loader while checking authentication', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: null,
      status: 'checking',
      isReady: false,
      loading: true,
      logout: jest.fn(),
      reason: null,
    });

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Checking reporter session…')).toBeTruthy();
    expect(screen.queryByText('Not signed in')).toBeNull();
  });

  it('redirects anonymous users to reporter login with the current route as next', () => {
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

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(routerState.replace).toHaveBeenCalledWith('/reporter/login?next=%2Freporter%2Fsubmissions');
    expect(screen.getByText('Checking reporter session…')).toBeTruthy();
    expect(screen.queryByText('Login required')).toBeNull();
  });

  it('renders submission records for an authenticated reporter session', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'reporter@example.com' },
      reporter: { email: 'reporter@example.com' },
      authenticated: true,
      profile: null,
      status: 'authenticated',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: null,
    });
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [{ id: 'story-1', headline: 'Road repair update', category: 'Civic', status: 'pending', createdAt: '2026-04-05T10:00:00.000Z' }],
      isLoading: false,
      error: null,
      errorStatus: null,
      hasLoadedOnce: true,
    });

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Submission Records')).toBeTruthy();
    expect(screen.getByText('Road repair update')).toBeTruthy();
    expect(routerState.replace).not.toHaveBeenCalled();
  });

  it('keeps an authenticated reporter on submissions when records fail auth upstream', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'reporter@example.com' },
      reporter: { email: 'reporter@example.com' },
      authenticated: true,
      profile: null,
      status: 'authenticated',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: null,
    });
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      isLoading: false,
      error: 'load failed',
      errorStatus: 401,
      hasLoadedOnce: true,
    });

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(routerState.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Submission Records')).toBeTruthy();
    expect(screen.getByText('Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeTruthy();
  });

  it('renders a valid empty reporter-owned result without the temporary unavailable message', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'reporter@example.com' },
      reporter: { email: 'reporter@example.com' },
      authenticated: true,
      profile: null,
      status: 'authenticated',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: null,
    });

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('No submissions linked to this Reporter Portal account yet.')).toBeTruthy();
    expect(screen.queryByText('Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeNull();
  });

  it('renders temporary unavailable for reporter stories API failures', () => {
    useReporterPortalSessionMock.mockReturnValue({
      session: { email: 'reporter@example.com' },
      reporter: { email: 'reporter@example.com' },
      authenticated: true,
      profile: null,
      status: 'authenticated',
      isReady: true,
      loading: false,
      logout: jest.fn(),
      reason: null,
    });
    useCommunityStoriesMock.mockReturnValue({
      settings: { communityReporterEnabled: true, allowMyStoriesPortal: true },
      settingsLoading: false,
      stories: [],
      isLoading: false,
      error: 'load failed',
      errorStatus: 500,
      hasLoadedOnce: true,
    });

    render(<ReporterSubmissionsPage communityReporterClosed={false} reporterPortalClosed={false} />);

    expect(screen.getByText('Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.')).toBeTruthy();
  });
});