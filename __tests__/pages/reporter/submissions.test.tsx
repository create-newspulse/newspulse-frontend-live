import { render, screen } from '@testing-library/react';
import Details from '../../../pages/reporter/submissions/[id]';
import { getServerSideProps as nested } from '../../../pages/community-reporter/my-stories';
import { getServerSideProps as hyphenated } from '../../../pages/community-reporter-my-stories';
import { fetchPublicSettings, readStoryDetail } from '../../../lib/communityReporterApi';
import type { ReporterStory } from '../../../lib/reporterStories';

const mockRouter={asPath:'/reporter/submissions/'+ '1'.repeat(24),query:{id:'1'.repeat(24)},locale:'en',replace:jest.fn()};
jest.mock('next/router',()=>({useRouter:()=>mockRouter}));
jest.mock('../../../hooks/useReporterPortalSession',()=>({useReporterPortalSession:()=>({status:'authenticated',session:{accountId:'a'.repeat(24),email:'a@example.invalid'}})}));
jest.mock('../../../hooks/usePublicFounderToggles',()=>({usePublicFounderToggles:()=>({toggles:{}})}));
jest.mock('../../../lib/communityReporterApi',()=>({...jest.requireActual('../../../lib/communityReporterApi'),fetchPublicSettings:jest.fn(),readStoryDetail:jest.fn()}));
const base:ReporterStory={id:'1'.repeat(24),headline:'Fixture headline',story:'Story',category:null,originalLanguage:null,location:null,
  canEdit:false,canWithdraw:false,reporterFeedback:null,createdAt:null,updatedAt:null,reviewStatus:'APPROVED',publicationStatus:'draft',isPublished:false,editions:[],publicUrl:null};
beforeEach(()=>{
  jest.mocked(fetchPublicSettings).mockResolvedValue({allowMyStoriesPortal:true,allowJournalistApplications:true,allowNewSubmissions:true,communityReporterEnabled:true});
});
test.each([['en','Approved','Editorial draft','Civic Issue'],['hi','स्वीकृत','संपादकीय मसौदा','नागरिक समस्या'],['gu','મંજૂર','સંપાદકીય ડ્રાફ્ટ','નાગરિક સમસ્યા']])('%s: renders receipt decision separately from publication, without a draft link to a public article',async(locale,approved,draft,category)=>{
  mockRouter.locale=locale;
  jest.mocked(readStoryDetail).mockResolvedValue({...base,category:'Civic Issue',reporterFeedback:'Released feedback',internalComment:'staff only'} as ReporterStory);
  render(<Details communityReporterClosed={false} reporterPortalClosed={false}/>);
  expect(await screen.findByText(approved)).toBeTruthy(); expect(screen.getByText(draft)).toBeTruthy();
  expect(screen.getByText(category)).toBeTruthy();
  expect(screen.getByText('Released feedback')).toBeTruthy(); expect(screen.queryByText('staff only')).toBeNull();
  expect(document.querySelector('a[href*="/s/"]')).toBeNull();
});
test.each([nested,hyphenated])('legacy URLs redirect to protected tracking in the same locale; no user selector survives',async loader=>{
  const res={setHeader:jest.fn()};
  const result=await loader({locale:'hi',defaultLocale:'en',query:{email:'ignored@example.invalid'},res} as unknown as Parameters<typeof loader>[0]);
  expect(result).toEqual({redirect:{destination:'/hi/reporter/submissions',permanent:false}});
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');
});
