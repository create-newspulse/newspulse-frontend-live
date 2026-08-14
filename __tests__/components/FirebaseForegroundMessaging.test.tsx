import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import FirebaseForegroundMessaging from '../../components/FirebaseForegroundMessaging';
import { listenForForegroundFcmMessages } from '../../lib/firebaseMessaging';
import { sendPushReceipt } from '../../lib/pushReceiptClient';

jest.mock('../../lib/firebaseMessaging', () => ({
  listenForForegroundFcmMessages: jest.fn(),
  summarizeForegroundFcmMessage: jest.fn(() => ({ messageId: 'message-id', hasNotification: true, hasData: true, link: '/news/story' })),
}));

jest.mock('../../lib/pushReceiptClient', () => ({
  sendPushReceipt: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
}));

describe('FirebaseForegroundMessaging', () => {
  let foregroundHandler: ((payload: any) => void | Promise<void>) | null = null;
  let showNotification: jest.Mock;
  let windowOpen: jest.SpyInstance;
  let consoleInfo: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    foregroundHandler = null;
    showNotification = jest.fn().mockResolvedValue(undefined);
    windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
    consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    (listenForForegroundFcmMessages as jest.Mock).mockImplementation(async (handler) => {
      foregroundHandler = handler;
      return jest.fn();
    });
  });

  afterEach(() => {
    windowOpen.mockRestore();
    consoleInfo.mockRestore();
    delete (window as any).Notification;
    delete (navigator as any).serviceWorker;
  });

  it('sends a received receipt and shows a foreground browser notification', async () => {
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        notification: { title: 'Foreground title', body: 'Foreground body' },
        data: {
          deliveryLogId: 'foreground-delivery-log',
          type: 'article',
          url: '/news/foreground-story',
          token: 'must-not-log-token',
          fid: 'must-not-log-fid',
        },
      });
    });

    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'foreground-delivery-log', event: 'received' });
    expect(showNotification).toHaveBeenCalledWith('Foreground title', expect.objectContaining({
      body: 'Foreground body',
      data: {
        url: '/news/foreground-story',
        deliveryLogId: 'foreground-delivery-log',
        type: 'article',
      },
    }));
    expect(screen.queryByTestId('foreground-push-alert')).toBeNull();
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-token');
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-fid');
  });

  it('shows an in-page foreground alert when browser notification cannot be shown', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        notification: { title: 'Toast title', body: 'Toast body' },
        data: { deliveryLogId: 'toast-delivery-log', url: '/breaking/toast-story' },
      });
    });

    const alert = await screen.findByTestId('foreground-push-alert');
    expect(alert.textContent).toContain('Toast title');
    expect(alert.textContent).toContain('Toast body');
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'toast-delivery-log', event: 'received' });

    fireEvent.click(alert);
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'toast-delivery-log', event: 'clicked' });
    expect(windowOpen).toHaveBeenCalledWith('/breaking/toast-story', '_self', 'noopener,noreferrer');
  });
});