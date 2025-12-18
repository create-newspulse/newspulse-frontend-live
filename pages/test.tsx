import Head from 'next/head';
import React from 'react';
import type { GetStaticProps } from 'next';

export default function TestPage() {
  return (
    <div>
      <Head>
        <title>Test Page</title>
      </Head>
      <h1>Hello from Test Page!</h1>
      <p>If you can see this, Next.js is working correctly.</p>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};