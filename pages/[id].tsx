import React from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

const DynamicNewsPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div className="min-h-screen p-10 bg-white">
      <h1 className="text-2xl font-bold text-gray-800">📰 News ID: {id}</h1>
      <p className="text-gray-600 mt-4">
        This is a dynamic news page for article ID: <strong>{id}</strong>.
      </p>
    </div>
  );
};

export default DynamicNewsPage;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
