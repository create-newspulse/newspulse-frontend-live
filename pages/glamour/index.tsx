import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'glamour');

export default function GlamourPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Glamour" categoryKey="glamour" useCategoryShell initialItems={initialItems} />;
}
