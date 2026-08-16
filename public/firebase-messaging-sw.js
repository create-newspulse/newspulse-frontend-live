/* global firebase */
const FIREBASE_SDK_VERSION = '12.17.1';
const CONFIG_CACHE_NAME = 'news-pulse-firebase-messaging-config-v1';
const CONFIG_CACHE_KEY = '/firebase-messaging-config';
const NEWS_PULSE_ORIGIN = 'https://www.newspulse.co.in';
const NEWS_PULSE_NOTIFICATION_TITLE = 'News Pulse';
const BREAKING_NOTIFICATION_TITLE = '🔴 Breaking News';
const DEFAULT_NOTIFICATION_BODY = 'Tap to read the latest update on News Pulse.';
const ARTICLE_NOTIFICATION_FALLBACK_BODY = 'Tap to read the full story on News Pulse.';
const NOTIFICATION_ICON = '/icons/news-pulse-icon-192.png';
const NOTIFICATION_BADGE = '/icons/news-pulse-badge-72.png';
const handledBackgroundPayloadKeys = new Set();

try {
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`);
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`);
} catch (error) {
  console.warn('[FCM SW] Firebase scripts could not be loaded.', error);
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
    if (url.protocol === 'https:' && (hostname === 'www.newspulse.co.in' || hostname === 'newspulse.co.in')) {
      return url.href;
    }
  } catch {}
  return `${NEWS_PULSE_ORIGIN}/`;
}

function getTagSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getSlugFromUrl(value) {
  try {
    const url = new URL(String(value || '/'), NEWS_PULSE_ORIGIN);
    const parts = url.pathname.split('/').filter(Boolean);
    return getTagSegment(parts[parts.length - 1]);
  } catch {}
  return '';
}

function getContentHash(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getNotificationTag(payload, safeUrl, body) {
  const data = payload?.data || {};
  const type = String(data.type || '').trim();
  if (type === 'breaking') {
    return 'news-pulse-breaking-latest';
  }

  const articleSegment =
    getTagSegment(data.articleId || data.article_id || data.articleID || data.id || data.newsId || data.slug || data.articleSlug || data.article_slug) ||
    getSlugFromUrl(safeUrl) ||
    getTagSegment(data.deliveryLogId) ||
    'latest-article';
  return `news-pulse-article-${articleSegment}`;
}

function getPayloadDedupeKey(payload) {
  const data = payload?.data || {};
  return String(data.deliveryLogId || payload?.messageId || payload?.message_id || '').trim();
}

function shouldHandleBackgroundPayload(payload) {
  const key = getPayloadDedupeKey(payload);
  if (!key) return true;
  if (handledBackgroundPayloadKeys.has(key)) return false;
  handledBackgroundPayloadKeys.add(key);
  return true;
}

function sendPushReceipt(deliveryLogId, event) {
  const safeDeliveryLogId = String(deliveryLogId || '').trim();
  const safeEvent = ['received', 'shown', 'display_failed', 'clicked'].includes(event) ? event : 'received';
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
  const type = String(data.type || '').trim();
  const articleBody = data.title || data.body || notification.title || notification.body || data.summary || ARTICLE_NOTIFICATION_FALLBACK_BODY;
  const breakingBody = data.body || data.title || data.message || notification.body || data.text || data.summary || DEFAULT_NOTIFICATION_BODY;
  const defaultBody = notification.body || data.body || data.message || data.text || data.summary || DEFAULT_NOTIFICATION_BODY;
  const body = type === 'breaking' ? breakingBody : type === 'article' ? articleBody : defaultBody;
  const url = getSafeNewsPulseUrl(getNotificationLink(payload));
  return {
    title: type === 'breaking' ? BREAKING_NOTIFICATION_TITLE : NEWS_PULSE_NOTIFICATION_TITLE,
    body,
    url,
    tag: getNotificationTag(payload, url, body),
    deliveryLogId: String(data.deliveryLogId || '').trim(),
    type,
  };
}

function handleBackgroundPushPayload(payload) {
  if (!shouldHandleBackgroundPayload(payload)) return Promise.resolve();
  const details = getNotificationDetails(payload);
  const options = {
    body: details.body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: details.tag,
    renotify: false,
    data: {
      deliveryLogId: details.deliveryLogId,
      type: details.type,
      url: details.url,
    },
  };

  return sendPushReceipt(details.deliveryLogId, 'received').then(async () => {
    try {
      await self.registration.showNotification(details.title, options);
      await sendPushReceipt(details.deliveryLogId, 'shown');
    } catch {
      await sendPushReceipt(details.deliveryLogId, 'display_failed');
    }
  });
}

function readPushEventPayload(event) {
  try {
    if (typeof event.data?.json === 'function') return event.data.json();
  } catch {}
  try {
    if (typeof event.data?.text === 'function') return JSON.parse(event.data.text());
  } catch {}
  return null;
}

function initializeFirebaseMessaging(config) {
  if (!self.firebase || !hasFirebaseConfig(config)) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(handleBackgroundPushPayload);
  } catch (error) {
    console.warn('[FCM SW] Firebase Messaging could not be initialized.', error);
  }
}

self.addEventListener('push', (event) => {
  const payload = readPushEventPayload(event);
  if (!payload) return;
  event.waitUntil(handleBackgroundPushPayload(payload));
});

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
    Promise.all([
      sendPushReceipt(deliveryLogId, 'clicked'),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existingClient = clients.find((client) => client.url === url);
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(url);
      }),
    ])
  );
});

readCachedFirebaseConfig().then((config) => {
  initializeFirebaseMessaging(config);
});