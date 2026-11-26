import { reporterRecordHandler } from '../../../lib/reporterRecords.server';

// Compatibility URL; query emails and directory identifiers never select the owner.
export default reporterRecordHandler('list');
