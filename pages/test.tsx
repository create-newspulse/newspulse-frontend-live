import Head from 'next/head';

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