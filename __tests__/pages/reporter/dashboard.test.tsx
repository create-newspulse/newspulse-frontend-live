import { render, screen, waitFor } from '@testing-library/react';
import ReporterDashboard from '../../../pages/reporter/dashboard';
import { useReporterPortalSession } from '../../../hooks/useReporterPortalSession';
import { readStoryList, readStorySummary, fetchPublicSettings, ReporterReadError } from '../../../lib/communityReporterApi';

const mockRouter = { asPath:'/reporter/dashboard',locale:'en',query:{}, replace:jest.fn() };
jest.mock('next/router',()=>({useRouter:()=>mockRouter}));
jest.mock('../../../hooks/useReporterPortalSession',()=>({useReporterPortalSession:jest.fn()}));
jest.mock('../../../hooks/usePublicFounderToggles',()=>({usePublicFounderToggles:()=>({toggles:{}})}));
jest.mock('../../../lib/communityReporterApi',()=>({...jest.requireActual('../../../lib/communityReporterApi'),fetchPublicSettings:jest.fn(),readStoryList:jest.fn(),readStorySummary:jest.fn()}));
const props={communityReporterClosed:false,reporterPortalClosed:false};
beforeEach(()=>{
  jest.clearAllMocks();
  jest.mocked(fetchPublicSettings).mockResolvedValue({allowMyStoriesPortal:true, allowNewSubmissions:true, allowJournalistApplications:true, communityReporterEnabled:true});
});
test.each(['checking','anonymous'])('%s never loads private data from a stale local email',async status=>{
  jest.mocked(useReporterPortalSession).mockReturnValue({status,session:{email:'old@example.invalid'}} as ReturnType<typeof useReporterPortalSession>);
  render(<ReporterDashboard {...props} />);
  expect(screen.getByText('Checking reporter session…')).toBeTruthy();
  expect(readStoryList).not.toHaveBeenCalled();
  if (status==='anonymous') await waitFor(()=>expect(mockRouter.replace).toHaveBeenCalledWith('/reporter/login?next=%2Freporter%2Fdashboard'));
});
test('counts from the owner summary, not number of visible editions or page rows',async()=>{
  jest.mocked(useReporterPortalSession).mockReturnValue({status:'authenticated',session:{accountId:'a'.repeat(24),email:'a@example.invalid'}} as ReturnType<typeof useReporterPortalSession>);
  jest.mocked(readStoryList).mockResolvedValue({page:1,limit:5,items:[],total:0});
  jest.mocked(readStorySummary).mockResolvedValue({totalSubmissions:23,received:21,pending:17,approved:2,published:1,rejected:2});
  render(<ReporterDashboard {...props} />);
  expect((await screen.findByText('All stories, including private drafts')).nextElementSibling?.textContent).toBe('23');
  expect(screen.getByText('Published stories').nextElementSibling?.textContent).toBe('1');
});
test('session denial during private reads clears the record view instead of treating it as empty',async()=>{
  jest.mocked(useReporterPortalSession).mockReturnValue({status:'authenticated',session:{accountId:'b'.repeat(24),email:'b@example.invalid'}} as ReturnType<typeof useReporterPortalSession>);
  jest.mocked(readStorySummary).mockRejectedValue(new ReporterReadError(403));
  render(<ReporterDashboard {...props} />);
  await waitFor(()=>expect(mockRouter.replace).toHaveBeenCalledWith('/reporter/login?next=%2Freporter%2Fdashboard'));
  expect(screen.queryByText('All stories, including private drafts')).toBeNull();
});
