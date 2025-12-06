export interface SubmitCommunityStoryPayload {
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  city: string;
  state: string;
  country: string;
  ageGroup: string;
  category: string;
  headline: string;
  story: string;
  reporterType: 'community' | 'journalist';
  preferredLanguages?: string[];
  communityInterests?: string[];
  journalistCharterAccepted?: boolean;
  generalEthicsAccepted?: boolean;
  organisationName?: string;
  organisationType?: 'print' | 'tv' | 'radio' | 'digital' | 'freelance' | 'other';
  positionTitle?: string;
  beatsProfessional?: string[];
  yearsExperience?: string;
  websiteOrPortfolio?: string;
  socialLinks?: { linkedin?: string; twitter?: string };
  heardAbout?: string;
}

export interface SubmitCommunityStoryResult {
  ok: boolean;
  referenceId: string;
  status: string;
  reporterType: 'community' | 'journalist';
}

export async function submitCommunityStory(
  payload: SubmitCommunityStoryPayload,
): Promise<SubmitCommunityStoryResult> {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const requestUrl = `/api/community-reporter/submit`;

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      reporterName: payload.reporterName,
      reporterEmail: payload.reporterEmail,
      reporterPhone: payload.reporterPhone,
      reporterCity: payload.city,
      reporterState: payload.state,
      reporterCountry: payload.country,
      reporterType: payload.reporterType,
      category: payload.category,
      headline: payload.headline,
      storyText: payload.story,
      ageGroup: payload.ageGroup,
      preferredLanguages: payload.preferredLanguages || [],
    }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const ref = data?.referenceId || '';
    const status = data?.status || 'under_review';
    const type = (payload.reporterType as 'community' | 'journalist') || 'community';
    return { ok: false, referenceId: ref, status, reporterType: type };
  }

  const referenceId = data?.referenceId || data?.id || '';
  const status = data?.status || 'Under review';
  const reporterType = (data?.reporterType as 'community' | 'journalist') || payload.reporterType;

  return { ok: true, referenceId, status, reporterType };
}
