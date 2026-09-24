import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'sports');

export default function SportsPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Sports" categoryKey="sports" useCategoryShell initialItems={initialItems} />;
}
