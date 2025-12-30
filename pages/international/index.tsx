import type { GetServerSideProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import type { Article } from '../../lib/publicNewsApi';
import { fetchCategoryNews } from '../../lib/fetchCategoryNews';

type Props = {
  articles: Article[];
  error?: string | null;
  messages: any;
  locale: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  const { items, error } = await fetchCategoryNews({ categoryKey: 'international', limit: 30 });

  return { props: { articles: items, error: error ?? null, messages, locale } };
};

export default function International({ articles, error }: Props) {
  const title = 'International';
  return (
    <CategoryFeedPage
      categoryKey="international"
      title={title}
      items={articles}
      emptyMessage={`No ${title.toLowerCase()} news published yet.`}
      error={error}
    />
  );
}
