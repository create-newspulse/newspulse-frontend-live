export type PublicComplianceSettings = {
  founderName: string;
  grievanceOfficerName: string;
  grievanceOfficerDesignation: string;
  grievanceEmail: string;
  grievanceOfficerLocation: string;
  publisherEntity: string;
  websiteUrl: string;
  chiefEditorName: string;
  chiefEditorDesignation: string;
  editorialEmail: string;
  showPublisherEntity: boolean;
  showFounderPublisher: boolean;
  showChiefEditor: boolean;
};

export const DEFAULT_PUBLIC_COMPLIANCE_SETTINGS: PublicComplianceSettings = {
  founderName: 'Kiran Parmar',
  grievanceOfficerName: '',
  grievanceOfficerDesignation: '',
  grievanceEmail: 'grievance@newspulse.co.in',
  grievanceOfficerLocation: 'India',
  publisherEntity: 'News Pulse Media',
  websiteUrl: 'https://www.newspulse.co.in',
  chiefEditorName: '',
  chiefEditorDesignation: '',
  editorialEmail: '',
  showPublisherEntity: true,
  showFounderPublisher: false,
  showChiefEditor: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function pickText(source: Record<string, unknown> | null, keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = normalizeText(source[key]);
    if (value) return value;
  }
  return '';
}

function pickBoolean(source: Record<string, unknown> | null, keys: string[]): boolean | null {
  if (!source) return null;
  for (const key of keys) {
    const value = normalizeBoolean(source[key]);
    if (value !== null) return value;
  }
  return null;
}

export function normalizePublicComplianceSettings(payload: unknown): PublicComplianceSettings {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const settings =
    root && isRecord(root.item) ? root.item :
    data && isRecord(data.item) ? data.item :
    root && isRecord(root.settings) ? root.settings :
    root && isRecord(root.complianceSettings) ? root.complianceSettings :
    data ? data :
    root;

  const founderName = pickText(settings, ['founderName', 'publisherName', 'founder', 'ownerName']);
  const grievanceOfficerName = pickText(settings, ['grievanceOfficerName', 'officerName', 'grievanceOfficer', 'name']);
  const grievanceOfficerDesignation = pickText(settings, ['grievanceOfficerDesignation', 'designation', 'officerDesignation', 'title']);
  const grievanceEmail = pickText(settings, ['grievanceEmail', 'email', 'contactEmail']);
  const grievanceOfficerLocation = pickText(settings, ['grievanceOfficerLocation', 'location', 'country', 'jurisdiction']);
  const publisherEntity = pickText(settings, ['publisherEntity', 'entityName', 'publisher', 'entity', 'brand', 'companyName']);
  const websiteUrl = pickText(settings, ['websiteUrl', 'website', 'siteUrl', 'url']);
  const chiefEditorName = pickText(settings, ['chiefEditorName', 'editorName']);
  const chiefEditorDesignation = pickText(settings, ['chiefEditorDesignation', 'editorDesignation']);
  const editorialEmail = pickText(settings, ['editorialEmail', 'chiefEditorEmail']);
  const showPublisherEntity = pickBoolean(settings, ['showPublisherEntity']);
  const showFounderPublisher = pickBoolean(settings, ['showFounderPublisher']);
  const showChiefEditor = pickBoolean(settings, ['showChiefEditor']);

  return {
    founderName: founderName || DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.founderName,
    grievanceOfficerName,
    grievanceOfficerDesignation,
    grievanceEmail: grievanceEmail || DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.grievanceEmail,
    grievanceOfficerLocation: grievanceOfficerLocation || DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.grievanceOfficerLocation,
    publisherEntity: publisherEntity || DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.publisherEntity,
    websiteUrl: websiteUrl || DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.websiteUrl,
    chiefEditorName,
    chiefEditorDesignation,
    editorialEmail,
    showPublisherEntity: showPublisherEntity ?? DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.showPublisherEntity,
    showFounderPublisher: showFounderPublisher ?? DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.showFounderPublisher,
    showChiefEditor: showChiefEditor ?? DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.showChiefEditor,
  };
}

export async function fetchPublicComplianceSettings(
  input: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    cacheBust?: boolean;
  } = {},
): Promise<PublicComplianceSettings> {
  const endpoint = String(input.endpoint || '/api/public/compliance-settings').trim() || '/api/public/compliance-settings';
  const requestUrl = input.cacheBust
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}t=${Date.now()}`
    : endpoint;
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(requestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: input.signal,
    });
    const data = await response.json().catch(() => null as unknown);

    if (!response.ok) {
      return DEFAULT_PUBLIC_COMPLIANCE_SETTINGS;
    }

    return normalizePublicComplianceSettings(data);
  } catch {
    return DEFAULT_PUBLIC_COMPLIANCE_SETTINGS;
  }
}