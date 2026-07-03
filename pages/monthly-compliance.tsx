import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/monthly-compliance-report',
    permanent: false,
  },
});

export default function MonthlyComplianceRedirectPage() {
  return null;
}