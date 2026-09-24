import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'web-stories');

export default function WebStoriesPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Web Stories" categoryKey="web-stories" useCategoryShell initialItems={initialItems} />;
}
