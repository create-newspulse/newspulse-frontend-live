import type { GetServerSideProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import type { Article } from '../../lib/publicNewsApi';
import { fetchCategoryNews } from '../../lib/fetchCategoryNews';

type Props = {
  categoryKey: string;
  title: string;
  articles: Article[];
  error?: string | null;
  messages: any;
  locale: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  const { items, error } = await fetchCategoryNews({ categoryKey: 'sports', limit: 30 });

  return {
    props: {
      categoryKey: 'sports',
      title: 'Sports',
      articles: items,
      error: error ?? null,
      messages,
      locale,
    },
  };
};

export default function SportsPage({ categoryKey, title, articles, error }: Props) {
  return (
    <CategoryFeedPage
      categoryKey={categoryKey}
      title={title}
      items={articles}
      emptyMessage={`No ${title.toLowerCase()} news published yet.`}
      error={error}
    />
  );
}
