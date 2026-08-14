import React from 'react';
import type { MessagePayload } from 'firebase/messaging';
import { listenForForegroundFcmMessages, summarizeForegroundFcmMessage } from '../lib/firebaseMessaging';
import { sendPushReceipt } from '../lib/pushReceiptClient';

const DEFAULT_FOREGROUND_BODY = 'Tap to read the full story on News Pulse.';
const NEWS_PULSE_ORIGIN = 'https://www.newspulse.co.in';
const NEWS_PULSE_HOME_URL = `${NEWS_PULSE_ORIGIN}/`;
const ALLOWED_NEWS_PULSE_HOSTS = new Set(['www.newspulse.co.in', 'newspulse.co.in']);

type ForegroundAlert = {
  title: string;
  body: string;
  url: string;
  deliveryLogId: string;
};

function getSafeForegroundUrl(value: unknown): string {
  const raw = String(value || NEWS_PULSE_HOME_URL).trim();
  try {
    const url = new URL(raw || NEWS_PULSE_HOME_URL, NEWS_PULSE_ORIGIN);
    const hostname = url.hostname.toLowerCase();
    if (ALLOWED_NEWS_PULSE_HOSTS.has(hostname)) {
      return url.href;
    }
  } catch {}
  return NEWS_PULSE_HOME_URL;
}

function getForegroundAlert(payload: MessagePayload): ForegroundAlert {
  const data = payload.data || {};
  return {
    title: payload.notification?.title || data.title || 'News Pulse',
    body: payload.notification?.body || data.body || data.summary || DEFAULT_FOREGROUND_BODY,
    url: getSafeForegroundUrl(payload.fcmOptions?.link || data.link || data.url),
    deliveryLogId: String(data.deliveryLogId || '').trim(),
  };
}

function isFcmTestControlEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_FCM_TEST_CONTROL === 'true';
}

async function showForegroundBrowserNotification(alert: ForegroundAlert, payload: MessagePayload): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (typeof registration.showNotification !== 'function') return false;
    await registration.showNotification(alert.title, {
      body: alert.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: {
        url: alert.url,
        deliveryLogId: alert.deliveryLogId,
        type: String(payload.data?.type || '').trim(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export default function FirebaseForegroundMessaging() {
  const [alert, setAlert] = React.useState<ForegroundAlert | null>(null);

  React.useEffect(() => {
    let unsubscribe = () => {};
    let mounted = true;

    listenForForegroundFcmMessages(
      async (payload) => {
        const nextAlert = getForegroundAlert(payload);
        void sendPushReceipt({ deliveryLogId: nextAlert.deliveryLogId, event: 'received' }).catch(() => undefined);
        const shown = await showForegroundBrowserNotification(nextAlert, payload);
        if (!shown && mounted) setAlert(nextAlert);
        if (isFcmTestControlEnabled()) {
          console.info('[FCM] Foreground message received', summarizeForegroundFcmMessage(payload));
        }
      },
      (error) => {
        if (isFcmTestControlEnabled()) {
          console.warn('[FCM] Foreground messaging unavailable', error instanceof Error ? error.message : error);
        }
      }
    ).then((nextUnsubscribe) => {
      if (!mounted) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!alert) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void sendPushReceipt({ deliveryLogId: alert.deliveryLogId, event: 'clicked' }).catch(() => undefined);
        window.open(alert.url, '_self', 'noopener,noreferrer');
        setAlert(null);
      }}
      className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-900 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.65)] focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
      data-testid="foreground-push-alert"
    >
      <span className="block text-sm font-black">{alert.title}</span>
      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{alert.body}</span>
    </button>
  );
}