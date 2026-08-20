import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase'

function cleanString(value: unknown): string {
  return String(value || '').trim()
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean)
    : []
}

function readJsonBody(req: NextApiRequest): Record<string, any> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, any>
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, any>
    } catch {
      return {}
    }
  }
  return {}
}

function isPublicSafeMessage(value: string): boolean {
  if (!value || /^submit_failed$/i.test(value)) return false
  if (/axios|stack|trace|pages\/api|internal|exception|error:/i.test(value)) return false
  return true
}

function resolveValidationMessage(status: number, data: any): string {
  const message = cleanString(data?.message)
  if (status === 400) {
    if (isPublicSafeMessage(message)) return message

    const errors = data?.errors
    if (Array.isArray(errors)) {
      const first = errors.map((item) => cleanString(item?.message || item)).find(isPublicSafeMessage)
      if (first) return first
    }
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors).map((item: any) => cleanString(Array.isArray(item) ? item[0] : item)).find(isPublicSafeMessage)
      if (first) return first
    }

    return 'Please check the required story details and try submitting again.'
  }

  return isPublicSafeMessage(message) ? message : "We couldn't submit your story right now. Please try again."
}

function resolveBackendAgeGroup(value: unknown): string {
  const ageGroup = cleanString(value)
  switch (ageGroup) {
    case 'under_18':
      return 'Under 18'
    case '18_24':
      return '18-24'
    case '25_40':
      return '25-40'
    case '41_plus':
      return '41+'
    default:
      return ageGroup
  }
}

function buildBackendPayload(body: Record<string, any>) {
  const reporterType = cleanString(body.reporterType) === 'journalist' ? 'journalist' : 'community'
  const beats = cleanStringArray(body.beats)

  return {
    reporterAccountId: cleanString(body.reporterAccountId) || undefined,
    reporterProfileId: cleanString(body.reporterProfileId) || undefined,
    reporterType,
    reporterName: cleanString(body.reporterName),
    reporterEmail: cleanString(body.reporterEmail).toLowerCase(),
    reporterPhone: cleanString(body.reporterPhone),
    reporterWhatsApp: cleanString(body.reporterWhatsApp),
    city: cleanString(body.city),
    district: cleanString(body.district),
    state: cleanString(body.state),
    country: cleanString(body.country),
    ageGroup: resolveBackendAgeGroup(body.ageGroup),
    category: cleanString(body.category),
    coverageScope: cleanString(body.coverageScope),
    headline: cleanString(body.headline),
    story: cleanString(body.story),
    mediaLink: cleanString(body.mediaLink) || undefined,
    priority: cleanString(body.priority) === 'high' ? 'high' : 'normal',
    storyCity: cleanString(body.storyCity) || undefined,
    storyDistrict: cleanString(body.storyDistrict) || undefined,
    storyState: cleanString(body.storyState) || undefined,
    storyCountry: cleanString(body.storyCountry) || undefined,
    preferredLanguages: cleanStringArray(body.preferredLanguages),
    consentToContact: Boolean(body.consentToContact),
    beats,
    communityInterests: reporterType === 'community' ? cleanStringArray(body.communityInterests || beats) : undefined,
    journalistCharterAccepted: Boolean(body.journalistCharterAccepted),
    generalEthicsAccepted: Boolean(body.generalEthicsAccepted),
    organisationName: cleanString(body.organisationName) || undefined,
    organisationType: cleanString(body.organisationType) || undefined,
    positionTitle: cleanString(body.positionTitle) || undefined,
    beatsProfessional: reporterType === 'journalist' ? cleanStringArray(body.beatsProfessional || beats) : undefined,
    yearsExperience: cleanString(body.yearsExperience) || undefined,
    professionalJournalistId: cleanString(body.professionalJournalistId) || undefined,
    journalistIdFileId: cleanString(body.journalistIdFileId) || undefined,
    heardAbout: cleanString(body.heardAbout) || undefined,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ code: 'method_not_allowed' })
  }

  const base = getPublicApiBaseUrl().replace(/\/+$/, '')
  if (!base) {
    return res.status(500).json({ error: 'missing_api_base', message: 'Missing env var: NEXT_PUBLIC_API_BASE' })
  }

  const targetUrl = `${base}/api/community/submissions`

  try {
    const body = readJsonBody(req)
    const backendPayload = buildBackendPayload(body)

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(backendPayload),
    })

    const text = await upstream.text().catch(() => '')

    if (!upstream.ok) {
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {}
      return res.status(upstream.status || 500).json({ ok: false, message: resolveValidationMessage(upstream.status, data), code: upstream.status === 400 ? 'VALIDATION_ERROR' : 'SUBMISSION_FAILED' })
    }

    try {
      const json = text ? JSON.parse(text) : { success: true }
      return res.status(upstream.status || 200).json(json)
    } catch {
      return res.status(upstream.status || 200).json({ success: true })
    }
  } catch {
    console.error('[community-reporter][submit] proxy exception')
    return res.status(500).json({ ok: false, message: "We couldn't submit your story right now. Please try again." })
  }
}
