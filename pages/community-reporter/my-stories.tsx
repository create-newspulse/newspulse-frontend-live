import type { GetServerSideProps } from 'next';

export default function LegacyTracking() { return null; }

export const getServerSideProps: GetServerSideProps = async ({ locale, defaultLocale, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const prefix = locale && locale !== defaultLocale ? `/${locale}` : '';
  return { redirect: { destination: `${prefix}/reporter/submissions`, permanent: false } };
};
