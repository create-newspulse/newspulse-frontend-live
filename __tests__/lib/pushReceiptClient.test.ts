import { sendPushReceipt } from '../../lib/pushReceiptClient';

describe('lib/pushReceiptClient', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('sends only deliveryLogId and event in push receipt payloads', async () => {
    const result = await sendPushReceipt({ deliveryLogId: 'delivery-log-123', event: 'received' });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect((global as any).fetch).toHaveBeenCalledWith('/api/public/push/receipt', expect.objectContaining({ method: 'POST' }));
    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ deliveryLogId: 'delivery-log-123', event: 'received' });
    expect(init.body).not.toContain('token');
    expect(init.body).not.toContain('fid');
    expect(init.body).not.toContain('registrationId');
  });

  it('does not throw when receipt delivery fails', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(sendPushReceipt({ deliveryLogId: 'delivery-log-123', event: 'clicked' })).resolves.toMatchObject({ ok: false });
  });

  it('skips receipt calls when deliveryLogId is missing', async () => {
    const result = await sendPushReceipt({ deliveryLogId: '', event: 'received' });

    expect(result.ok).toBe(false);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });
});
