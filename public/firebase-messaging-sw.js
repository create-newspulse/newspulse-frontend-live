/* global firebase */
const FIREBASE_SDK_VERSION = '12.17.1';
const CONFIG_CACHE_NAME = 'news-pulse-firebase-messaging-config-v1';
const CONFIG_CACHE_KEY = '/firebase-messaging-config';

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

function initializeFirebaseMessaging(config) {
  if (!self.firebase || !hasFirebaseConfig(config)) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const title = notification.title || 'News Pulse';
      const options = {
        body: notification.body || '',
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        data: {
          link: getNotificationLink(payload),
        },
      };

      return self.registration.showNotification(title, options);
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
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === link || client.url.endsWith(link));
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(link);
    })
  );
});

readCachedFirebaseConfig().then((config) => {
  initializeFirebaseMessaging(config);
});