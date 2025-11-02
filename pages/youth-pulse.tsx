import Head from 'next/head';
import dynamic from 'next/dynamic';

const YouthPulse = dynamic(() => import('../components/YouthPulse'), { ssr: false });

export default function YouthPulsePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Youth Pulse - News Pulse</title>
        <meta name="description" content="Campus news, careers, exams, and youth achievements." />
      </Head>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">🎓 Youth Pulse</h1>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border shadow-sm">
          <YouthPulse />
        </div>
      </div>
    </div>
  );
}
