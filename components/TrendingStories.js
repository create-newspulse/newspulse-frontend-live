// components/TrendingStories.js
import {useTranslations} from 'next-intl';
import { COVER_PLACEHOLDER_SRC, onCoverImageError, resolveCoverImageUrl } from '../lib/coverImages';

const TrendingStories = ({ articles }) => {
  const t = useTranslations();
  if (!articles || articles.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold mb-3 text-red-600">🔥 {t('trending.title')}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {articles.slice(0, 8).map((article, index) => (
          <div
            key={index}
            className="min-w-[200px] max-w-[200px] bg-white rounded-xl shadow-md overflow-hidden snap-start"
          >
            <div className="w-full h-28 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveCoverImageUrl(article) || COVER_PLACEHOLDER_SRC}
                alt={article.title}
                onError={onCoverImageError}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-2">
              <p className="text-sm font-medium line-clamp-2">{article.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrendingStories;
