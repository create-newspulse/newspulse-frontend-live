// pages/business.tsx
import { useEffect, useState } from "react";
import type { GetStaticProps } from "next";
import { useTranslations } from 'next-intl';
import { fetchRssNews } from "../lib/fetchRssNews";

export default function Business() {
  const t = useTranslations('categories');
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetchRssNews("Business").then(setNews);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">💼 {t('business')}</h1>
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
  const { getMessages } = await import("../lib/getMessages");
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
