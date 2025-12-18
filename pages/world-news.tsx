// pages/world-news.tsx
import { useEffect, useState } from "react";
import { fetchRssNews } from "../lib/fetchRssNews";
import type { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';

export default function WorldNews() {
  const t = useTranslations('categories');
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetchRssNews("World News").then(setNews);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">🌍 {t('international')}</h1>
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
