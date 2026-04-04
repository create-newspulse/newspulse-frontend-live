import { createAdminApiProxyHandler } from '../../../../lib/adminApiProxy';

export default createAdminApiProxyHandler({
  allowMethods: ['GET', 'PUT', 'PATCH', 'POST'],
  upstreamPath: '/api/admin/founder/feature-toggles',
});