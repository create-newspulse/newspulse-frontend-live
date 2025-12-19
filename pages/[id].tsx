import React from 'react';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useFeatureFlags } from '../utils/FeatureFlagProvider';

const DynamicNewsPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { isEnabled } = useFeatureFlags();

  return (
    <div className="min-h-screen p-10 bg-white">
      <h1 className="text-2xl font-bold text-gray-800">📰 News ID: {id}</h1>
      <p className="text-gray-600 mt-4">
        This is a dynamic news page for article ID: <strong>{id}</strong>.
      </p>

      {isEnabled('comments.enabled', true) && (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-800">Comments</h2>
          <p className="text-gray-600 mt-2">Comments are enabled, but the comment system is not configured on this page yet.</p>
        </section>
      )}
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
