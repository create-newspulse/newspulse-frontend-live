/* global firebase */
const FIREBASE_SDK_VERSION = '12.17.1';
const CONFIG_CACHE_NAME = 'news-pulse-firebase-messaging-config-v1';
const CONFIG_CACHE_KEY = '/firebase-messaging-config';
const NEWS_PULSE_ORIGIN = 'https://www.newspulse.co.in';
const DEFAULT_NOTIFICATION_BODY = 'Tap to read the latest update on News Pulse.';

try {
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`);
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`);
} catch (error) {
  console.warn('[FCM SW] Firebase scripts could not be loaded.', error);
}

function hasFirebaseConfig(config) {
  return Boolean(
    config &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId
  );
}

async function readCachedFirebaseConfig() {
  try {
    const cache = await caches.open(CONFIG_CACHE_NAME);
    const response = await cache.match(CONFIG_CACHE_KEY);
    if (!response) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function writeCachedFirebaseConfig(config) {
  try {
    const cache = await caches.open(CONFIG_CACHE_NAME);
    await cache.put(CONFIG_CACHE_KEY, new Response(JSON.stringify(config), { headers: { 'Content-Type': 'application/json' } }));
  } catch {}
}

function getNotificationLink(payload) {
  return payload?.fcmOptions?.link || payload?.data?.link || payload?.data?.url || '/';
}

function getSafeNewsPulseUrl(value) {
  try {
    const url = new URL(String(value || '/'), NEWS_PULSE_ORIGIN);
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'www.newspulse.co.in' || hostname === 'newspulse.co.in') {
      return url.href;
    }
  } catch {}
  return `${NEWS_PULSE_ORIGIN}/`;
}

function sendPushReceipt(deliveryLogId, event) {
  const safeDeliveryLogId = String(deliveryLogId || '').trim();
  const safeEvent = event === 'clicked' ? 'clicked' : 'received';
  if (!safeDeliveryLogId) return Promise.resolve();

  return fetch('/api/public/push/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ deliveryLogId: safeDeliveryLogId, event: safeEvent }),
  }).catch(() => undefined);
}

function getNotificationDetails(payload) {
  const data = payload?.data || {};
  const notification = payload?.notification || {};
  return {
    title: notification.title || data.title || 'News Pulse',
    body: notification.body || data.body || data.summary || DEFAULT_NOTIFICATION_BODY,
    url: getSafeNewsPulseUrl(getNotificationLink(payload)),
    deliveryLogId: String(data.deliveryLogId || '').trim(),
    type: String(data.type || '').trim(),
  };
}

function initializeFirebaseMessaging(config) {
  if (!self.firebase || !hasFirebaseConfig(config)) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const details = getNotificationDetails(payload);
      const options = {
        body: details.body,
        icon: payload?.notification?.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        data: {
          url: details.url,
          deliveryLogId: details.deliveryLogId,
          type: details.type,
        },
      };

      return Promise.all([
        sendPushReceipt(details.deliveryLogId, 'received'),
        self.registration.showNotification(details.title, options),
      ]);
    });
  } catch (error) {
    console.warn('[FCM SW] Firebase Messaging could not be initialized.', error);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'NEWS_PULSE_FIREBASE_CONFIG') return;
  const config = event.data.config;
  if (!hasFirebaseConfig(config)) return;

  event.waitUntil(
    writeCachedFirebaseConfig(config).then(() => {
      initializeFirebaseMessaging(config);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = getSafeNewsPulseUrl(data.url);
  const deliveryLogId = data.deliveryLogId;
  event.waitUntil(
    sendPushReceipt(deliveryLogId, 'clicked').then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existingClient = clients.find((client) => client.url === url);
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(url);
      })
    )
  );
});

readCachedFirebaseConfig().then((config) => {
  initializeFirebaseMessaging(config);
});