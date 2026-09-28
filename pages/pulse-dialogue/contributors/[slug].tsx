import type { GetServerSideProps } from 'next';
import PulseDialogueArchivePage from '../../../components/PulseDialogueArchivePage';
import { getDialogueArchiveProps, type DialogueArchiveProps } from '../../../server/pulseDialogueArchive';

export const getServerSideProps: GetServerSideProps<DialogueArchiveProps> = (ctx) => getDialogueArchiveProps(ctx, 'contributors');

export default PulseDialogueArchivePage;