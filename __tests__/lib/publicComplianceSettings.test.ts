import {
  DEFAULT_PUBLIC_COMPLIANCE_SETTINGS,
  fetchPublicComplianceSettings,
  normalizePublicComplianceSettings,
} from '../../lib/publicComplianceSettings';

describe('lib/publicComplianceSettings', () => {
  it('unwraps backend compliance settings from the item field', () => {
    const settings = normalizePublicComplianceSettings({
      ok: true,
      item: {
        founderName: 'Kiran Parmar',
        grievanceOfficerName: 'Shailesh Rathod',
        grievanceOfficerDesignation: 'Grievance Officer',
        grievanceEmail: 'grievance@newspulse.co.in',
        grievanceOfficerLocation: 'India',
        chiefEditorName: 'Shailesh Rathod',
      },
    });

    expect(settings.founderName).toBe('Kiran Parmar');
    expect(settings.grievanceOfficerName).toBe('Shailesh Rathod');
    expect(settings.grievanceOfficerDesignation).toBe('Grievance Officer');
    expect(settings.grievanceEmail).toBe('grievance@newspulse.co.in');
    expect(settings.grievanceOfficerLocation).toBe('India');
    expect(settings.publisherEntity).toBe(DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.publisherEntity);
    expect(settings.websiteUrl).toBe(DEFAULT_PUBLIC_COMPLIANCE_SETTINGS.websiteUrl);
    expect(settings.chiefEditorName).toBe('Shailesh Rathod');
  });

  it('fetches and unwraps backend compliance settings from the item field', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        item: {
          founderName: 'Kiran Parmar',
          grievanceOfficerName: 'Shailesh Rathod',
          grievanceOfficerDesignation: 'Grievance Officer',
          grievanceEmail: 'grievance@newspulse.co.in',
          grievanceOfficerLocation: 'India',
          chiefEditorName: 'Shailesh Rathod',
        },
      }),
    });

    const settings = await fetchPublicComplianceSettings({ fetchImpl, cacheBust: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/public\/compliance-settings\?t=\d+$/),
      expect.objectContaining({ method: 'GET', cache: 'no-store' })
    );
    expect(settings.grievanceOfficerName).toBe('Shailesh Rathod');
    expect(settings.grievanceOfficerDesignation).toBe('Grievance Officer');
    expect(settings.grievanceOfficerLocation).toBe('India');
  });

  it('unwraps backend compliance settings from data.item', () => {
    const settings = normalizePublicComplianceSettings({
      ok: true,
      data: {
        item: {
          founderName: 'Kiran Parmar',
          publisherEntity: 'News Pulse Media',
          grievanceOfficerName: 'Shailesh Rathod',
          grievanceOfficerDesignation: 'Grievance Officer',
          grievanceEmail: 'grievance@newspulse.co.in',
          grievanceOfficerLocation: 'India',
          chiefEditorName: 'Shailesh Rathod',
          chiefEditorDesignation: 'Chief Editor',
          editorialEmail: 'newspulse.team@gmail.com',
        },
      },
    });

    expect(settings.grievanceOfficerName).toBe('Shailesh Rathod');
    expect(settings.grievanceOfficerDesignation).toBe('Grievance Officer');
    expect(settings.grievanceOfficerLocation).toBe('India');
    expect(settings.chiefEditorDesignation).toBe('Chief Editor');
    expect(settings.editorialEmail).toBe('newspulse.team@gmail.com');
  });
});