import { useEffect, useState } from 'react';
import { useLanguage } from '../utils/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import fetchTopNewswithAutoKey from '../lib/fetchTopNewsAuto';
import type { GetStaticProps } from 'next';

export default function InternationalNews() {
  const { language } = useLanguage();
  const [topHeadlines, setTopHeadlines] = useState<any[]>([]);

  // Fetch whenever language changes
  useEffect(() => {
    fetchTopNewswithAutoKey(language).then(setTopHeadlines);
  }, [language]);

  return (
    <>
      <LanguageToggle />
      <main className={`p-4 ${language === 'hindi' ? 'font-hindi' : 'font-english'}`}>
        <h1 className="text-4xl font-bold text-center text-blue-700">
          🔵 News Pulse – {language === 'hindi' ? 'Hindi' : language === 'gujarati' ? 'Gujarati' : 'English'}
        </h1>
        {topHeadlines.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {topHeadlines.map((article, i) => (
              <li key={i}>
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-yellow-600 text-center mt-10">⚠️ No news available.</p>
        )}
      </main>
    </>
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
