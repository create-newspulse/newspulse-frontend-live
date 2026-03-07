// components/TrendingStories.js
import {useTranslations} from 'next-intl';
import { resolveCoverImageUrl } from '../lib/coverImages';
import { StoryImage } from '../src/components/story/StoryImage';

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
            className="group shrink-0 bg-white rounded-xl shadow-md snap-start"
          >
            <StoryImage
              src={resolveCoverImageUrl(article)}
              alt={article?.title || ''}
              variant="card"
              className="rounded-t-xl rounded-b-none"
            />
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
