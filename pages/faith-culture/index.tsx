import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'faith-culture');

export default function FaithCulturePage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Faith & Culture" categoryKey="faith-culture" useCategoryShell initialItems={initialItems} />;
}