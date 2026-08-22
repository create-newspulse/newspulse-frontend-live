import type { GetServerSideProps } from 'next';

export const getServerSideProps = (async () => {
  return {
    redirect: {
      destination: '/advertise-with-us',
      permanent: false,
    },
  };
}) satisfies GetServerSideProps;

export default function AdvertisingRedirectPage() {
  return null;
}
