// pages/gujarat.tsx
import { useEffect, useState } from 'react';
import { fetchRssNews } from '../lib/fetchRssNews';
import type { GetStaticProps } from 'next';

const EMPTY_NEWS: any[] = [];

export default function GujaratNews({ initialNews = EMPTY_NEWS }: { initialNews?: any[] }) {
  const [news, setNews] = useState<any[]>(initialNews);

  useEffect(() => {
    const controller = new AbortController();
    setNews(initialNews);
    const refresh = () => fetchRssNews('Gujarati', { signal: controller.signal, throwOnError: true })
      .then((items) => { if (!controller.signal.aborted) setNews(items); }).catch(() => {});
    if (!initialNews.length) void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [initialNews]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-4">🟢 Gujarat News Pulse</h1>
      <ul className="space-y-3">
        {news.map((item, index) => (
          <li key={index}>
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-newsPulse-blue hover:underline">
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale, revalidateReason }) => {
  const { getMessages } = await import('../lib/getMessages');
  let initialNews: any[] = [];
  try {
    initialNews = await fetchRssNews('Gujarati', { throwOnError: true });
  } catch (error) {
    if (revalidateReason === 'stale') throw error;
  }
  return {
    props: {
      messages: await getMessages(locale as string),
      initialNews,
    },
    revalidate: 60,
  };
};
