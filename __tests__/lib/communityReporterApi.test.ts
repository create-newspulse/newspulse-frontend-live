import { readStoryList, withdrawStoryById, fetchPublicSettings } from '../../lib/communityReporterApi';
import settingsHandler from '../../pages/api/public/community/settings';
import { publicReporterBackendFetch, reporterIngressAvailable } from '../../lib/reporterBackend.server';
import type { NextApiRequest, NextApiResponse } from 'next';
jest.mock('../../lib/reporterBackend.server', () => ({ publicReporterBackendFetch: jest.fn(), reporterIngressAvailable: jest.fn() }));
const a = 'a'.repeat(24), id = '1'.repeat(24);
beforeEach(() => { global.fetch = jest.fn(); });
test('scopes requests to the session, not a query selector, and does not cache them', async () => {
  jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ok:true,items:[],total:0,meta:{page:1,limit:20,total:0}})));
  expect((await readStoryList(a,1,20)).items).toEqual([]);
  expect(fetch).toHaveBeenCalledWith('/api/reporter-portal/submissions?page=1&limit=20',expect.objectContaining({credentials:'same-origin',cache:'no-store',headers:expect.objectContaining({'X-Reporter-Account':a})}));
  await expect(readStoryList('unverified@example.invalid',1,20)).rejects.toMatchObject({status:401});
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([401,403,503])('denied HTTP %s takes precedence over any upstream rows', async status => {
  jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ok:true,items:[{id}]}),{status}));
  await expect(readStoryList(a,1,20)).rejects.toMatchObject({status});
});
test('withdrawal uses the mounted owner proxy and never a browser-supplied directory ID',async () => {
  jest.mocked(fetch).mockResolvedValue(new Response('{"ok":true}'));
  await withdrawStoryById(id,a);
  expect(fetch).toHaveBeenCalledWith(`/api/community-reporter/${id}/withdraw`,expect.objectContaining({method:'POST',body:'{}'}));
});
test('public settings distinguish unreadable settings from a confirmed open portal', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true, settings:{communityReporterEnabled:true,allowMyStoriesPortal:true,allowJournalistApplications:false,allowNewSubmissions:false}})));
  expect(await fetchPublicSettings()).toBeNull();
  expect(await fetchPublicSettings()).toMatchObject({allowMyStoriesPortal:true,allowNewSubmissions:false});
});
test.each([null, { communityReporterEnabled:'false' }, { allowNewSubmissions:true }])('unknown or malformed upstream settings never grant a permissive fallback', async settings => {
  jest.mocked(reporterIngressAvailable).mockReturnValue(true);
  jest.mocked(publicReporterBackendFetch).mockResolvedValue(new Response(JSON.stringify({ ok:true, settings })));
  const res = { status:jest.fn().mockReturnThis(), setHeader:jest.fn(), json:jest.fn() };
  const req = {method:'GET'} as NextApiRequest;
  await settingsHandler(req, res as Partial<NextApiResponse> as NextApiResponse);
  expect(publicReporterBackendFetch).toHaveBeenCalledWith(req, '/api/public/community/settings');
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ ok:false, code:'COMMUNITY_SETTINGS_UNAVAILABLE', settings:{
    communityReporterEnabled:false, allowMyStoriesPortal:false, allowNewSubmissions:false, allowJournalistApplications:false,
  } });
});
