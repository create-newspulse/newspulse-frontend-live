import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'tech-gadgets');

export default function TechGadgetsPage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Tech & Gadgets" categoryKey="tech-gadgets" useCategoryShell initialItems={initialItems} />;
}