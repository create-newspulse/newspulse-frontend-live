// pages/gujarat.tsx
import { useEffect, useState } from 'react';
import { fetchRssNews } from '../lib/fetchRssNews';
import type { GetStaticProps } from 'next';

export default function GujaratNews() {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetchRssNews("Gujarati").then(setNews); // ✅ pass argument
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-4">🟢 Gujarat News Pulse</h1>
      <ul className="space-y-3">
        {news.map((item, index) => (
          <li key={index}>
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {item.title}
            </a>
          </li>
        ))}
      </ul>
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
