import type { GetStaticProps } from 'next';

import CategoryFeedPage from '../../components/CategoryFeedPage';
import { getCategoryStaticProps, type CategoryPageProps } from '../../lib/categoryPageProps';

export const getStaticProps: GetStaticProps<CategoryPageProps> = (ctx) => getCategoryStaticProps(ctx, 'pulse-dialogue');

export default function PulseDialoguePage({ initialItems }: CategoryPageProps) {
  return <CategoryFeedPage title="Pulse Dialogue" categoryKey="pulse-dialogue" useCategoryShell initialItems={initialItems} />;
}