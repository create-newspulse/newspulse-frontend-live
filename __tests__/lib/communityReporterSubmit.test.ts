import { patchReporterDraft, submitCommunityStory, submitYouthPulseStory, type CommunityReporterAgeGroup } from '../../src/lib/communityReporterApi';
import { projectStory } from '../../lib/reporterStories';

function createCommunityPayload(ageGroup: CommunityReporterAgeGroup = '18_24') {
  return {
    reporterName: 'Test User',
    reporterEmail: 'test@example.com',
    ageGroup,
    category: 'regional',
    coverageScope: 'regional' as const,
    headline: 'Hello',
    story: 'This is a sufficiently long story text to pass validation.',
    generalEthicsAccepted: true,
  };
}

describe('submitCommunityStory (identity anchors)', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ referenceId: 'ref-1', status: 'Under review', reporterType: 'community' }),
    });
  });

  const id = '123456789012345678901234', accountId = 'abcdefabcdefabcdefabcdef';
  const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  it('requires the receipt of the requested kind and never retries or follows redirects', async () => {
    const payload = createCommunityPayload();
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(201, { ok: true, actor: 'guest', referenceId: id }));
    await expect(submitCommunityStory(payload, { kind: 'guest' })).resolves.toEqual({ ok: true, referenceId: id });
    for (const [status, body] of [
      [201, { ok: true, actor: 'guest', referenceId: id }], [200, { ok: true, actor: 'account', referenceId: id }],
      [201, { ok: false, actor: 'account', referenceId: id }], [201, { ok: true, actor: 'account', referenceId: '' }],
    ] as const) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(response(status, body));
      await expect(submitCommunityStory(payload, { kind: 'account', accountId })).resolves.toEqual({ ok: false, reason: 'uncertain' });
    }
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(global.fetch).toHaveBeenLastCalledWith('/api/community/submissions', expect.objectContaining({
      redirect: 'error', credentials: 'same-origin', headers: expect.objectContaining({ 'X-Reporter-Account': accountId }),
    }));
  });
  it('accepts only the requested PATCH ID, content, language and transition', async () => {
    const item = { id, headline: 'Old', story: 'Old sentence', category: 'Civic Issue', originalLanguage: 'gu',
      reviewStatus: 'NEEDS_REVISION', publicationStatus: 'not_published', isPublished: false, publicUrl: null, editions: [], canEdit: true, reporterFeedback: null };
    const existing = projectStory(item);
    const edit = { headline: 'New', story: 'New text', category: 'civic_issue', action: 'draft' as const };
    const expected = { ...item, headline: edit.headline, story: edit.story };
    for (const override of [{ id: accountId }, { reviewStatus: 'DRAFT' }, { story: 'different' }, { originalLanguage: 'en' }]) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, { ok: true, item: { ...expected, ...override } }));
      await expect(patchReporterDraft(existing, accountId, edit)).resolves.toEqual({ ok: false, reason: 'uncertain' });
    }
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(200, { ok: true, item: expected }));
    await expect(patchReporterDraft(existing, accountId, edit)).resolves.toMatchObject({ ok: true, item: { id, reviewStatus: 'NEEDS_REVISION' } });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[4];
    expect(url).toBe(`/api/reporter-portal/submissions/${id}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ ...edit, category: 'Civic Issue' });
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

  it.each(['success', 'http-error', 'network-error'])('keeps personal form data and response details out of %s diagnostics', async (outcome) => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const privateDetail = 'private-fixture-detail';
    const networkError = new Error(privateDetail);
    (global as any).fetch = outcome === 'network-error'
      ? jest.fn().mockRejectedValue(networkError)
      : jest.fn().mockResolvedValue({ ok: outcome === 'success', status: outcome === 'success' ? 201 : 500, json: async () => ({ message: privateDetail }) });
    try {
      const submission = submitYouthPulseStory({
        reporterName: privateDetail, reporterEmail: 'fixture@example.invalid', mobileNumber: privateDetail,
        college: privateDetail, city: privateDetail, state: privateDetail, headline: privateDetail, story: privateDetail,
        track: 'campus-buzz', submissionType: 'student-voice', storySource: 'first-hand',
        truthfulnessConfirmed: true, rightsConfirmed: true, reviewAcknowledged: true, safetyConfirmed: true,
      });
      if (outcome === 'network-error') await expect(submission).rejects.toBe(networkError);
      else await submission;

      expect(info).toHaveBeenCalledWith('[submitYouthPulseStory] request', { requestUrl: '/api/public/youth-pulse/submit', method: 'POST' });
      if (outcome !== 'success') {
        expect(error).toHaveBeenCalledWith(expect.any(String), {
          requestUrl: '/api/public/youth-pulse/submit', method: 'POST', ...(outcome === 'http-error' ? { status: 500 } : {}),
        });
      }
      expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain(privateDetail);
      expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain('fixture@example.invalid');
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });
});
