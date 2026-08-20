import type { GetServerSideProps, NextPage } from 'next';
import { clearSessionCookie, getReporterSessionFromRequest } from '../../lib/reporterPortalAuth';

const ReporterIndexPage: NextPage = () => null;

export default ReporterIndexPage;

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const validation = getReporterSessionFromRequest(req);

  if (!validation.ok && validation.shouldClearCookie) {
    res.setHeader('Set-Cookie', clearSessionCookie());
  }

  return {
    redirect: {
      destination: validation.ok ? '/reporter/dashboard' : '/reporter/login',
      permanent: false,
    },
  };
};