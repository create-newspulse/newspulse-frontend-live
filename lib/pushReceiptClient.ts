export type PushReceiptEvent = 'received' | 'shown' | 'display_failed' | 'clicked';

export type PushReceiptInput = {
  deliveryLogId?: string | null;
  event: PushReceiptEvent;
};

export type PushReceiptResult = {
  ok: boolean;
  status?: number;
  message: string;
};

function cleanString(value: unknown): string {
  return String(value || '').trim();
}

export async function sendPushReceipt(input: PushReceiptInput): Promise<PushReceiptResult> {
  const deliveryLogId = cleanString(input.deliveryLogId);
  const event = ['received', 'shown', 'display_failed', 'clicked'].includes(input.event) ? input.event : 'received';

  if (!deliveryLogId) {
    return { ok: false, message: 'Push receipt delivery log id is missing.' };
  }

  try {
    const response = await fetch('/api/public/push/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ deliveryLogId, event }),
    });
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Push receipt sent.' : 'Push receipt failed.',
    };
  } catch {
    return { ok: false, message: 'Push receipt endpoint is currently unreachable.' };
  }
}