import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'editorial');

export default function EditorialPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Editorial" categoryKey="editorial" useCategoryShell initialItems={initialItems} />;
}
