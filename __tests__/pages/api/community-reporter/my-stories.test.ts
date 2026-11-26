import type { NextApiRequest, NextApiResponse } from 'next';
import legacy from '../../../../pages/api/community-reporter/my-stories';
import list from '../../../../pages/api/reporter-portal/submissions';
import detail from '../../../../pages/api/reporter-portal/submissions/[id]';
import summary from '../../../../pages/api/reporter-portal/dashboard/summary';
import withdraw from '../../../../pages/api/community-reporter/[id]/withdraw';
import { reporterBackendFetch, reporterIngressAvailable } from '../../../../lib/reporterBackend.server';
import { requireReporterSession } from '../../../../lib/reporterPortalAuth';
import { editionHref } from '../../../../lib/reporterStories';
import { communityReporterWriteGate } from '../../../../lib/communityReporterWriteGate.server';

jest.mock('../../../../lib/reporterBackend.server');
jest.mock('../../../../lib/reporterPortalAuth');
jest.mock('../../../../lib/communityReporterWriteGate.server');
const a = 'a'.repeat(24), b = 'b'.repeat(24), id = '1'.repeat(24);
const item = { id, headline: 'Synthetic text', story: 'A private fixture', canEdit: false, reporterFeedback: null, rawStatus: 'APPROVED',
  reviewStatus: 'APPROVED', publicationStatus: 'draft', isPublished: false, publicUrl: null, editions: [], createdAt: null };
const totals = { totalSubmissions: 1, received: 1, pending: 0, approved: 1, rejected: 0, published: 0 };
const listBody = (items: unknown[]) => ({ ok: true, items, total: items.length, meta: { page: 1, limit: 20, total: items.length } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;
async function invoke(handler: Handler, opts: { account?: string; method?: string; query?: Record<string,string>; body?: unknown; expected?: string; key?: string } = {}) {
  const { method = 'GET', account = a, query = {}, body, expected = account } = opts;
  const req: Partial<NextApiRequest> = { method, headers: { 'content-type':'application/json', 'x-reporter-account':expected, cookie:`synthetic=${account}`,
    ...(opts.key ? { 'idempotency-key':opts.key } : {}) }, query, body };
  let status = 0, result: any;
  const headers: Record<string,string> = {};
  const res = { setHeader(k:string,v:string){ headers[k]=v; }, status(n:number){status=n; return this;}, json(data:unknown){result=data;} };
  await handler(req as NextApiRequest, res as NextApiResponse);
  return { status, body: result, headers };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(communityReporterWriteGate).mockResolvedValue('open');
  jest.mocked(reporterIngressAvailable).mockReturnValue(true);
  jest.mocked(requireReporterSession).mockImplementation(async req => {
    const accountId = String(req.headers?.cookie).slice('synthetic='.length);
    return {ok:true, reporter:{accountId,email:`${accountId[0]}@example.invalid`}} as Awaited<ReturnType<typeof requireReporterSession>>;
  });
});
test.each([list, legacy])('only the session-scoped canonical list is consulted, regardless of supplied contact selectors', async handler => {
  jest.mocked(reporterBackendFetch).mockImplementation(async (req,path) => {
    expect(path).toBe('/api/reporter-portal/submissions?page=1&limit=20');
    return json(listBody(req.headers.cookie === `synthetic=${a}` ? [item] : []));
  });
  expect((await invoke(handler,{ query:{email:'b@example.invalid',reporterId:b} })).body.items.map(s=>s.id)).toEqual([id]);
  expect((await invoke(handler,{account:b, query:{email:'a@example.invalid'}})).body.items).toEqual([]);
  jest.mocked(reporterBackendFetch).mockResolvedValue(json(listBody([])));
  expect((await invoke(handler)).body.items).toEqual([]); // Historical, unwitnessed rows withheld by candidate.
});
test.each([401,403,404,500])('an upstream %s cannot return records, notes or contacts as an error', async status => {
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({items:[item],internalComment:'staff only'},status));
  const out = await invoke(detail,{account:b,query:{id}});
  expect(out.status).toBe(status); expect(Object.keys(out.body).sort()).toEqual(['code','ok']);
  expect(out.headers['Cache-Control']).toBe('private, no-store');
});
test('closed contract and owner changes deny reads and writes before reaching a record', async () => {
  jest.mocked(reporterIngressAvailable).mockReturnValue(false);
  expect((await invoke(list)).status).toBe(503);
  jest.mocked(reporterIngressAvailable).mockReturnValue(true);
  expect((await invoke(detail,{method:'PATCH',account:b,expected:a,query:{id},body:{action:'draft',headline:'Unsaved'}})).status).toBe(409);
  expect((await invoke(withdraw,{method:'POST',account:b,expected:a,query:{id}})).status).toBe(409);
  expect(reporterBackendFetch).not.toHaveBeenCalled();
});
test('projects only released reporter feedback and no private fields, even nested', async () => {
  const raw = { ...item, internalComment:'private1', rejectionReason:'private2', editorNote:'private3', reporterEmail:'private4',
    location:{city:'City',staff:'private5'}, attachments:[{name:'private6'}] };
  for (const reporterFeedback of [null,'Message released by Founder']) {
    jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:{...raw, reporterFeedback}}));
    const out = await invoke(detail,{query:{id}});
    expect(out.body.item.reporterFeedback).toBe(reporterFeedback);
    expect(JSON.stringify(out.body)).not.toMatch(/private[1-6]/);
  }
});
test('fails closed on old, mismatched, contradicted or incomplete response shapes', async () => {
  for (const rejected of [
    {id,headline:'Old',status:'published',articleId:'legacy'},
    {...item,id:b}, {...item,isPublished:true}, {...item,editions:[{language:'hi',publicUrl:'https://elsewhere.invalid/private'}]},
    {...item,publicationStatus:'published',isPublished:true,publicUrl:null,editions:[]},
  ]) {
    jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:rejected}));
    expect((await invoke(detail,{query:{id}})).status).toBe(502);
  }
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:false,items:[item]}));
  expect((await invoke(list)).status).toBe(502);
});
test('three published reader editions yield three exact language links and one server-counted story', async () => {
  const editions = (['en','hi','gu'] as const).map((language,i) => ({language,publicUrl:`/api/public/news/${String(i+2).repeat(24)}?lang=${language}`}));
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:{...item,isPublished:true,publicationStatus:'published',publicUrl:editions[0].publicUrl,editions}}));
  const out = await invoke(detail,{query:{id}});
  expect(out.body.item.editions.map(editionHref)).toEqual([`/s/${'2'.repeat(24)}`,`/hi/s/${'3'.repeat(24)}`,`/gu/s/${'4'.repeat(24)}`]);
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,summary:{...totals,published:1}}));
  expect((await invoke(summary)).body.summary).toEqual({...totals,published:1});
});
test('forwards PATCH only to the selected draft and never invents a save receipt on a 500', async () => {
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({},500));
  const out = await invoke(detail,{query:{id},method:'PATCH',body:{action:'draft',headline:'Unsaved',reporterAccountId:b,internalComment:'ignored'}});
  expect(out.status).toBe(500);
  expect(reporterBackendFetch).toHaveBeenCalledWith(expect.anything(),`/api/reporter-portal/submissions/${id}`,{method:'PATCH',body:{action:'draft',headline:'Unsaved'}});
  expect(out.body.ok).toBe(false);
});
const key = '50adfe2d-3ca2-4dfe-b2b4-6ebd2388499b';
const privateDraft = { ...item, headline: 'Headline only', story:'', category:null, originalLanguage:null, reviewStatus:'DRAFT', publicationStatus:'not_published', canEdit:true };
const create = { method:'POST', key, body:{ action:'draft', headline:'Headline only', submittedByAccountId:b, internalComment:'omit', generalEthicsAccepted:true } };
test('the canonical collection alone creates drafts, carries the UUID and requires a corroborated new or replay receipt', async () => {
  expect((await invoke(legacy,create)).status).toBe(405);
  expect((await invoke(list,{...create,key:'invalid'})).status).toBe(400);
  expect((await invoke(list,{...create,account:b,expected:a})).status).toBe(409);
  expect((await invoke(list,{...create,body:{action:'submit',headline:'No final write here'}})).status).toBe(400);
  expect(reporterBackendFetch).not.toHaveBeenCalled();
  for (const [status,created] of [[201,true],[200,false]] as const) {
    jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,created,item:{...privateDraft,internalComment:'omit'}},status));
    const out = await invoke(list,create);
    expect(out.status).toBe(status); expect(out.body).toMatchObject({ok:true,created,item:{id,category:null,reviewStatus:'DRAFT'}});
    expect(out.body.item.internalComment).toBeUndefined();
    expect(reporterBackendFetch).toHaveBeenLastCalledWith(expect.anything(),'/api/reporter-portal/submissions',{
      method:'POST',draftKey:key,body:{action:'draft',headline:'Headline only'}});
  }
  for (const bad of [{id:''},{reviewStatus:'SUBMITTED'},{category:'Civic Issue'},{originalLanguage:'gu'},{story:'unexpected'}]) {
    jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,created:true,item:{...privateDraft,...bad}},201));
    expect((await invoke(list,create)).status).toBe(502);
  }
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,created:true,item:privateDraft},200));
  expect((await invoke(list,create)).status).toBe(502);
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:privateDraft},400));
  expect((await invoke(list,create)).status).toBe(502);
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:false,code:'DRAFT_KEY_CONFLICT'},409));
  expect((await invoke(list,create)).body).toEqual({ok:false,code:'DRAFT_KEY_CONFLICT'});
});
test('withholds contradictory draft links and totals rather than counting a private draft as published', async () => {
  const e = {language:'gu', publicUrl:`/api/public/news/${id}?lang=gu`};
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:{...privateDraft,isPublished:true,publicationStatus:'published',publicUrl:e.publicUrl,editions:[e]}}));
  const out = await invoke(detail,{query:{id}});
  expect(out.status).toBe(502); expect(out.body).not.toHaveProperty('item');
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,summary:{...totals,approved:0,received:0,published:1}}));
  expect((await invoke(summary)).status).toBe(502);
});
test('final PATCH rejects incomplete fields or nonaffirmative consent, and confirms only a submitted receipt for this ID', async () => {
  const body = {action:'submit',headline:privateDraft.headline,story:'Complete',category:'Civic Issue',generalEthicsAccepted:true};
  const send = (change:Record<string,unknown> = {}) => invoke(detail,{method:'PATCH',query:{id},body:{...body,...change}});
  for (const change of [{generalEthicsAccepted:false},{generalEthicsAccepted:'true'},{generalEthicsAccepted:undefined},{category:undefined},{story:''},{headline:''}]) {
    expect((await send(change)).status).toBe(400);
  }
  expect(reporterBackendFetch).not.toHaveBeenCalled();
  const saved = {...privateDraft, ...body, canEdit:false, reviewStatus:'SUBMITTED'};
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:{...saved,id:b}}));
  expect((await send()).status).toBe(502);
  jest.mocked(reporterBackendFetch).mockResolvedValue(json({ok:true,item:saved}));
  expect((await send()).body.item.id).toBe(id);
  expect(reporterBackendFetch).toHaveBeenLastCalledWith(expect.anything(),`/api/reporter-portal/submissions/${id}`,{method:'PATCH',body});
});
