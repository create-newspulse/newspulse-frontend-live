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
  const originalFcmTestControl = process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL;
  let foregroundHandler: ((payload: any) => void | Promise<void>) | null = null;
  let showNotification: jest.Mock;
  let windowOpen: jest.SpyInstance;
  let consoleInfo: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    foregroundHandler = null;
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = 'false';
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

  afterAll(() => {
    process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL = originalFcmTestControl;
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
    expect(showNotification).toHaveBeenCalledWith('News Pulse', expect.objectContaining({
      body: 'Foreground title',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      data: {
        url: 'https://www.newspulse.co.in/news/foreground-story',
        deliveryLogId: 'foreground-delivery-log',
        type: 'article',
      },
    }));
    expect(screen.queryByTestId('foreground-push-alert')).toBeNull();
    expect(consoleInfo).not.toHaveBeenCalled();
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-token');
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-fid');
  });

  it('sends a received receipt and shows a foreground breaking browser notification', async () => {
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        data: {
          deliveryLogId: 'foreground-breaking-delivery-log',
          type: 'breaking',
          url: '/breaking/foreground-live',
          message: 'breaking message',
          token: 'must-not-log-token',
          fid: 'must-not-log-fid',
          registrationId: 'must-not-log-registration-id',
        },
      });
    });

    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'foreground-breaking-delivery-log', event: 'received' });
    expect(showNotification).toHaveBeenCalledWith('🔴 Breaking News', expect.objectContaining({
      body: 'breaking message',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      data: {
        url: 'https://www.newspulse.co.in/breaking/foreground-live',
        deliveryLogId: 'foreground-breaking-delivery-log',
        type: 'breaking',
      },
    }));
    expect(consoleInfo).not.toHaveBeenCalled();
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-token');
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-fid');
    expect(consoleInfo.mock.calls.flat().join(' ')).not.toContain('must-not-log-registration-id');
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
  expect(alert.textContent).toContain('News Pulse');
    expect(alert.textContent).toContain('Toast body');
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'toast-delivery-log', event: 'received' });

    fireEvent.click(alert);
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'toast-delivery-log', event: 'clicked' });
    expect(windowOpen).toHaveBeenCalledWith('https://www.newspulse.co.in/breaking/toast-story', '_self', 'noopener,noreferrer');
  });

  it('hides foreground diagnostics when FCM test control is disabled', async () => {
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        notification: { title: 'No diagnostics title', body: 'No diagnostics body' },
        data: { deliveryLogId: 'no-diagnostics-log', url: '/news/no-diagnostics' },
      });
    });

    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it('falls back to the News Pulse home page for unsafe foreground alert URLs', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        notification: { title: 'Unsafe title', body: 'Unsafe body' },
        data: { deliveryLogId: 'unsafe-delivery-log', url: 'https://example.com/phishing' },
      });
    });

    fireEvent.click(await screen.findByTestId('foreground-push-alert'));
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'unsafe-delivery-log', event: 'clicked' });
    expect(windowOpen).toHaveBeenCalledWith('https://www.newspulse.co.in/', '_self', 'noopener,noreferrer');
  });

  it('falls back to the News Pulse home page for non-HTTPS News Pulse foreground URLs', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    render(<FirebaseForegroundMessaging />);
    await waitFor(() => expect(listenForForegroundFcmMessages).toHaveBeenCalled());

    await act(async () => {
      await foregroundHandler?.({
        notification: { title: 'Unsafe protocol title', body: 'Unsafe protocol body' },
        data: { deliveryLogId: 'unsafe-protocol-delivery-log', url: 'http://newspulse.co.in/news/insecure' },
      });
    });

    fireEvent.click(await screen.findByTestId('foreground-push-alert'));
    expect(sendPushReceipt).toHaveBeenCalledWith({ deliveryLogId: 'unsafe-protocol-delivery-log', event: 'clicked' });
    expect(windowOpen).toHaveBeenCalledWith('https://www.newspulse.co.in/', '_self', 'noopener,noreferrer');
  });
});