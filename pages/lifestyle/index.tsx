import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'lifestyle');

export default function LifestylePage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Lifestyle" categoryKey="lifestyle" useCategoryShell initialItems={initialItems} />;
}
