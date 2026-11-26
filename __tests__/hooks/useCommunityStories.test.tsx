import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommunityStories } from '../../hooks/useCommunityStories';
import { readStoryDetail } from '../../lib/communityReporterApi';
import type { ReporterStory } from '../../lib/reporterStories';
jest.mock('../../lib/communityReporterApi', () => ({...jest.requireActual('../../lib/communityReporterApi'),readStoryDetail:jest.fn()}));
const a = 'a'.repeat(24), b='b'.repeat(24), id='1'.repeat(24);
const article = { id, headline:'Only for the first account' } as ReporterStory;
beforeEach(() => jest.clearAllMocks());
test('account switch/logout masks existing state immediately; a late private response cannot restore it', async () => {
  let finish!: (value:ReporterStory) => void;
  jest.mocked(readStoryDetail).mockResolvedValueOnce(article).mockImplementationOnce(() => new Promise(resolve=>{finish=resolve;}));
  const { result, rerender } = renderHook(({account}:{account:string|null})=>useCommunityStories(account,'detail',1,id), {initialProps:{account:a} as {account:string|null}});
  await waitFor(()=>expect(result.current.result).toEqual({state:'ready',data:{story:article}}));
  rerender({account:b});
  expect(result.current.result).toEqual({state:'loading'});
  rerender({account:null});
  await act(async()=>finish({...article,headline:'late data from second account'}));
  expect(result.current.result).toEqual({state:'loading'});
  expect(readStoryDetail).toHaveBeenCalledTimes(2);
});
test('signed-out email query or local profile cannot initiate a read', () => {
  window.localStorage.setItem('np_cr_email','old@example.invalid');
  renderHook(()=>useCommunityStories(null,'detail',1,id));
  expect(readStoryDetail).not.toHaveBeenCalled();
});
