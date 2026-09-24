import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'science-technology');

export default function ScienceTechnologyPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Science & Technology" categoryKey="science-technology" useCategoryShell initialItems={initialItems} />;
}
