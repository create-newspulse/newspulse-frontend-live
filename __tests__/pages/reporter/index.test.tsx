import React from 'react';
import { render, screen } from '@testing-library/react';
import ReporterIndexPage, { getServerSideProps as getReporterIndexServerSideProps } from '../../../pages/reporter';
import DynamicNewsPage from '../../../pages/[id]';
import { requireReporterSession } from '../../../lib/reporterPortalAuth';
import { getServerSideProps as nestedTracker } from '../../../pages/community-reporter/my-stories';
import { getServerSideProps as oldTracker } from '../../../pages/community-reporter-my-stories';

jest.mock('../../../lib/reporterPortalAuth', () => ({ requireReporterSession: jest.fn() }));

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
    (requireReporterSession as jest.Mock).mockResolvedValue({ ok: false, status: 401, reason: 'REPORTER_SESSION_MISSING' });
  });

  it('does not render the generic dynamic article page for /reporter', () => {
    render(<ReporterIndexPage />);

    expect(screen.queryByText(/News ID: reporter/i)).toBeNull();
    expect(screen.queryByText(/dynamic news page for article ID: reporter/i)).toBeNull();
  });

  it('redirects authenticated reporter sessions to the dashboard', async () => {
    (requireReporterSession as jest.Mock).mockResolvedValue({ ok: true, reporter: { accountId: '111111111111111111111111', email: 'one@example.test' } });
    const context = createServerSideContext({ reporter_portal_session: 'opaque-test' });
    const result = await getReporterIndexServerSideProps(context);
    expect(requireReporterSession).toHaveBeenCalledWith(context.req);
    expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));

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

  it('preserves the localized route on direct visits without treating a local cookie as authority', async () => {
    const ctx = { ...createServerSideContext({ np_reporter_portal_session: 'legacy' }), locale: 'gu', defaultLocale: 'en' };
    expect(await getReporterIndexServerSideProps(ctx)).toMatchObject({ redirect: { destination: '/gu/reporter/login' } });
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
it.each([oldTracker, nestedTracker])('redirects legacy tracking to the locale’s authenticated list, without retaining contact selectors', async handler => {
  for (const locale of ['en', 'hi', 'gu']) {
    const ctx = { ...createServerSideContext({}), locale, defaultLocale: 'en', query: { email: 'prior@example.invalid' } };
    const result = await handler(ctx);
    expect(result).toEqual({ redirect: { destination: `${locale === 'en' ? '' : `/${locale}`}/reporter/submissions`, permanent: false } });
    expect(ctx.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  }
});