import type { GetServerSideProps } from 'next';
import SubmissionExperience from '../../components/community-reporter/SubmissionExperience';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../types/community-reporter';

type Props = FeatureToggleProps & { draftId: string | null };

export default function ReporterSubmitPage(props: Props) {
  return <SubmissionExperience {...props} variant="portal" />;
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store');
  const common = await getReporterPortalPageServerProps(ctx);
  if (!('props' in common)) return common;
  // Missing, repeated and empty IDs must not collapse an edit link to creation.
  const draft = ctx.query.draft;
  return { props: { ...await common.props, draftId: draft === undefined ? null : typeof draft === 'string' ? draft : '' } };
};
