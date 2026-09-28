import type { GetServerSideProps } from 'next';
import PulseDialogueArchivePage from '../../../components/PulseDialogueArchivePage';
import { getDialogueArchiveProps, type DialogueArchiveProps } from '../../../lib/pulseDialogueArchive';

export const getServerSideProps: GetServerSideProps<DialogueArchiveProps> = (ctx) => getDialogueArchiveProps(ctx, 'series');

export default PulseDialogueArchivePage;