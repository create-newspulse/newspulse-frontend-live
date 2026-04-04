import { createAdminApiProxyHandler } from '../../../../lib/adminApiProxy';

export default createAdminApiProxyHandler({
  allowMethods: ['GET'],
  upstreamPath: '/api/admin/community/contributors',
});