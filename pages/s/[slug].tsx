import type { GetServerSidePropsContext } from 'next';
import ArticlePage, { getServerSideProps as getArticleProps } from '../news/[slug]';

export default ArticlePage;

// Retain the shared page's parameter name for its existing refresh lifecycle.
export const getServerSideProps = (context: GetServerSidePropsContext) =>
  getArticleProps(context, { shortLink: true });
