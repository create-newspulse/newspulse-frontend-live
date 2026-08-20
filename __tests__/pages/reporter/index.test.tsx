import React from 'react';
import { render, screen } from '@testing-library/react';
import ReporterIndexPage, { getServerSideProps as getReporterIndexServerSideProps } from '../../../pages/reporter';
import DynamicNewsPage from '../../../pages/[id]';
import { REPORTER_SESSION_COOKIE, createSessionToken } from '../../../lib/reporterPortalAuth';

const routerState = {
  query: {} as Record<string, string>,
  asPath: '/',
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('../../../utils/FeatureFlagProvider', () => ({
  useFeatureFlags: () => ({
    isEnabled: () => false,
  }),
}));

jest.mock('../../../utils/PublicModeProvider', () => ({
  usePublicMode: () => ({
    readOnly: false,
  }),
}));

function createServerSideContext(cookies: Record<string, string> = {}) {
  return {
    locale: 'en',
    req: { cookies },
    res: { setHeader: jest.fn() },
  } as any;
}

describe('pages/reporter index route', () => {
  beforeEach(() => {
    routerState.query = {};
    routerState.asPath = '/reporter';
  });

  it('does not render the generic dynamic article page for /reporter', () => {
    render(<ReporterIndexPage />);

    expect(screen.queryByText(/News ID: reporter/i)).toBeNull();
    expect(screen.queryByText(/dynamic news page for article ID: reporter/i)).toBeNull();
  });

  it('redirects authenticated reporter sessions to the dashboard', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    const result = await getReporterIndexServerSideProps(
      createServerSideContext({ [REPORTER_SESSION_COOKIE]: sessionToken })
    );

    expect(result).toEqual({
      redirect: {
        destination: '/reporter/dashboard',
        permanent: false,
      },
    });
  });

  it('redirects anonymous reporter visits to login', async () => {
    const result = await getReporterIndexServerSideProps(createServerSideContext());

    expect(result).toEqual({
      redirect: {
        destination: '/reporter/login',
        permanent: false,
      },
    });
  });

  it('keeps the generic dynamic article page working for legitimate article IDs', () => {
    routerState.query = { id: 'article-123' };
    routerState.asPath = '/article-123';

    render(<DynamicNewsPage />);

    expect(screen.getByText(/News ID:/i)).toBeTruthy();
    expect(screen.getByText('article-123')).toBeTruthy();
    expect(screen.getByText(/dynamic news page for article ID:/i)).toBeTruthy();
  });
});