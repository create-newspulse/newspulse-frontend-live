import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'business');

export default function BusinessPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Business" categoryKey="business" useCategoryShell initialItems={initialItems} />;
}
