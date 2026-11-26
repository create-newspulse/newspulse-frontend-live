import type { GetServerSideProps, NextPage } from 'next';
import { noStore } from '../../lib/reporterAuthProxy';
import { requireReporterSession } from '../../lib/reporterPortalAuth';

const ReporterIndexPage: NextPage = () => null;

export default ReporterIndexPage;

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale, defaultLocale }) => {
  noStore(res);
  const validation = await requireReporterSession(req);
  const prefix = locale && locale !== defaultLocale && ['hi', 'gu'].includes(locale) ? `/${locale}` : '';
  return {
    redirect: {
      destination: prefix + (validation.ok ? '/reporter/dashboard' : '/reporter/login'),
      permanent: false,
    },
  };
};