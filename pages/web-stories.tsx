import Head from 'next/head';
import dynamic from 'next/dynamic';

const WebStories = dynamic(() => import('../components/WebStories'), { ssr: false });

export default function WebStoriesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Web Stories - News Pulse</title>
        <meta name="description" content="Swipeable visual stories from News Pulse." />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">📚 Web Stories</h1>
        <WebStories />
      </div>
    </div>
  );
}
