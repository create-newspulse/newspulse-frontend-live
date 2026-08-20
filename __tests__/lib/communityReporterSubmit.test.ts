import { submitCommunityStory, submitYouthPulseStory, type CommunityReporterAgeGroup } from '../../src/lib/communityReporterApi';

function createCommunityPayload(ageGroup: CommunityReporterAgeGroup = '18_24') {
  return {
    reporterName: 'Test User',
    reporterEmail: 'test@example.com',
    ageGroup,
    category: 'regional',
    coverageScope: 'regional' as const,
    headline: 'Hello',
    story: 'This is a sufficiently long story text to pass validation.',
    reporterType: 'community' as const,
  };
}

describe('submitCommunityStory (identity anchors)', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ referenceId: 'ref-1', status: 'Under review', reporterType: 'community' }),
    });
  });

  it('posts one backend-compatible community submission payload', async () => {
    await submitCommunityStory({
      reporterAccountId: 'acct-1',
      reporterProfileId: 'prof-1',
      reporterName: 'Test User',
      reporterEmail: ' TEST@Example.com ',
      reporterPhone: '999',
      reporterWhatsApp: '888',
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      consentToContact: true,
      beats: ['Civic', 'Education'],
      ageGroup: '18_24',
      category: 'regional',
      coverageScope: 'regional',
      headline: 'Hello',
      story: 'This is a sufficiently long story text to pass validation.',
      reporterType: 'community',
      preferredLanguages: ['en'],
      communityInterests: ['Civic', 'Education'],
      mediaLink: 'https://example.com/photo.jpg',
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global as any).fetch.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe('/api/community/submissions');
    expect(body).toEqual({
      reporterAccountId: 'acct-1',
      reporterProfileId: 'prof-1',
      reporterType: 'community',
      reporterName: 'Test User',
      reporterEmail: 'test@example.com',
      reporterPhone: '999',
      reporterWhatsApp: '888',
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      ageGroup: '18_24',
      category: 'regional',
      coverageScope: 'regional',
      headline: 'Hello',
      story: 'This is a sufficiently long story text to pass validation.',
      mediaLink: 'https://example.com/photo.jpg',
      priority: 'normal',
      preferredLanguages: ['en'],
      consentToContact: true,
      beats: ['Civic', 'Education'],
      communityInterests: ['Civic', 'Education'],
      journalistCharterAccepted: false,
      generalEthicsAccepted: false,
    });
    expect(body.fullName).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.storyText).toBeUndefined();
    expect(body.reporterProfile).toBeUndefined();
    expect(body.meta).toBeUndefined();
  });

  it.each([
    ['Under 18', 'under_18'],
    ['18–24', '18_24'],
    ['25–40', '25_40'],
    ['41+', '41_plus'],
  ] as Array<[string, CommunityReporterAgeGroup]>)('posts %s as %s', async (_label, ageGroup) => {
    await submitCommunityStory(createCommunityPayload(ageGroup));

    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body).ageGroup).toBe(ageGroup);
  });

  it('returns public-safe validation messages for HTTP 400 without throwing', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'submit_failed', stack: 'Error: internal stack' }),
    });

    const result = await submitCommunityStory({
      ...createCommunityPayload('18_24'),
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Please check the highlighted details and try submitting again.');
  });

  it('tags Youth Pulse submissions for the Youth Pulse Desk workflow', async () => {
    await submitYouthPulseStory({
      reporterName: 'Student Reporter',
      reporterEmail: 'student@example.com',
      mobileNumber: '9999999999',
      college: 'GLS University',
      city: 'Ahmedabad',
      state: 'Gujarat',
      headline: 'Campus clean-up drive draws 200 volunteers',
      story: 'Students organized a clean-up drive across campus and nearby public areas.',
      track: 'campus-buzz',
      submissionType: 'student-voice',
      storySource: 'first-hand',
      truthfulnessConfirmed: true,
      rightsConfirmed: true,
      reviewAcknowledged: true,
      safetyConfirmed: true,
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global as any).fetch.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe('/api/public/youth-pulse/submit');
    expect(body.desk).toBe('youth-pulse');
    expect(body.track).toBe('campus-buzz');
    expect(body.category).toBe('Youth / Campus');
    expect(body.submissionType).toBe('youth-pulse');
    expect(body.youthSubmissionType).toBe('student-voice');
    expect(body.storySource).toBe('first-hand');
    expect(body.source).toBe('youth_pulse');
    expect(body.fullName).toBe('Student Reporter');
    expect(body.email).toBe('student@example.com');
    expect(body.reporterEmail).toBe('student@example.com');
    expect(body.reporterPhone).toBe('9999999999');
    expect(body.city).toBe('Ahmedabad');
    expect(body.state).toBe('Gujarat');
    expect(body.supportingLink).toBeUndefined();
    expect(body.attachmentLink).toBeUndefined();
    expect(body.truthfulnessConfirmed).toBe(true);
    expect(body.reviewAcknowledged).toBe(true);
    expect(body.moderationRequired).toBe(true);
    expect(body.autoPublish).toBe(false);
    expect(body.publishRequested).toBe(false);
    expect(body.meta.source).toBe('youth_pulse');
    expect(body.storyText).toContain('clean-up drive');
  });
});
