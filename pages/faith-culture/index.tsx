import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';
import { getFaithCultureTopic } from '../../lib/faithCultureTopics';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'faith-culture');

export default function FaithCulturePage({ initialItems, initialPagination, locale }: CategoryPageProps) {
  const router = useRouter();
  const topic = getFaithCultureTopic(router.query.topic);
  const extraQuery = useMemo(() => topic ? { topic } : undefined, [topic]);

  // ISR represents All; remounting also cancels and discards the previous topic's pages.
  return (
    <CategoryFeedPage
      key={topic || 'all'}
      title="Faith & Culture"
      categoryKey="faith-culture"
      useCategoryShell
      extraQuery={extraQuery}
      initialItems={topic ? undefined : initialItems}
      initialPagination={topic ? undefined : initialPagination}
      initialLocale={locale}
    />
  );
}