import type { GetServerSideProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';

type Props = {
  messages: any;
  locale: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const featureToggles = await fetchServerPublicFounderToggles();

  if (featureToggles.viralVideosFrontendEnabled === false) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  return {
    props: {
      messages,
      locale,
    },
  };
};

export default function ViralVideosPage() {
  return <CategoryFeedPage title="Viral Videos" categoryKey="viral-videos" extraQuery={{ type: 'video' }} />;
}
