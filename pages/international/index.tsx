import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'international');

export default function International({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="International" categoryKey="international" useCategoryShell initialItems={initialItems} />;
}
