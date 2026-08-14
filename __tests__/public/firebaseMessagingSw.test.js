const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createServiceWorkerHarness() {
  const listeners = {};
  const cache = {
    match: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
  };
  const showNotification = jest.fn().mockResolvedValue(undefined);
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  const openWindow = jest.fn().mockResolvedValue({});
  const skipWaiting = jest.fn().mockResolvedValue(undefined);
  const claim = jest.fn().mockResolvedValue(undefined);
  let backgroundHandler = null;

  const firebase = {
    apps: [],
    initializeApp: jest.fn(function initializeApp() {
      firebase.apps.push({ name: '[DEFAULT]' });
    }),
    messaging: jest.fn(() => ({
      onBackgroundMessage: jest.fn((handler) => {
        backgroundHandler = handler;
      }),
    })),
  };

  const sandbox = {
    console: { warn: jest.fn() },
    importScripts: jest.fn(),
    URL,
    Promise,
    String,
    JSON,
    Response,
    fetch: fetchMock,
    caches: { open: jest.fn().mockResolvedValue(cache) },
    firebase,
    self: {
      firebase,
      registration: { showNotification },
      skipWaiting,
      clients: {
        claim,
        matchAll: jest.fn().mockResolvedValue([]),
        openWindow,
      },
      addEventListener: jest.fn((type, handler) => {
        listeners[type] = handler;
      }),
    },
  };

  const source = fs.readFileSync(path.join(process.cwd(), 'public/firebase-messaging-sw.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'firebase-messaging-sw.js' });

  return {
    listeners,
    fetchMock,
    showNotification,
    openWindow,
    skipWaiting,
    clients: sandbox.self.clients,
    getBackgroundHandler: () => backgroundHandler,
  };
}

async function initializeFirebaseMessaging(harness) {
  let waitUntilPromise = Promise.resolve();
  harness.listeners.message({
    data: {
      type: 'NEWS_PULSE_FIREBASE_CONFIG',
      config: {
        apiKey: 'api-key',
        authDomain: 'news-pulse.firebaseapp.com',
        projectId: 'news-pulse',
        messagingSenderId: '123',
        appId: 'app-id',
      },
    },
    waitUntil: (promise) => {
      waitUntilPromise = promise;
    },
  });
  await waitUntilPromise;
}

describe('public/firebase-messaging-sw.js', () => {
  it('activates updated service worker versions promptly', async () => {
    const harness = createServiceWorkerHarness();
    let installPromise = Promise.resolve();
    let activatePromise = Promise.resolve();

    harness.listeners.install({
      waitUntil: (promise) => {
        installPromise = promise;
      },
    });
    harness.listeners.activate({
      waitUntil: (promise) => {
        activatePromise = promise;
      },
    });
    await installPromise;
    await activatePromise;

    expect(harness.skipWaiting).toHaveBeenCalled();
    expect(harness.clients.claim).toHaveBeenCalled();
  });

  it('sends a received receipt and shows a breaking background notification alert', async () => {
    const harness = createServiceWorkerHarness();
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'breaking-delivery-log-123',
        type: 'breaking',
        url: '/breaking/live-update',
        message: 'breaking message',
        token: 'must-not-send-token',
        fid: 'must-not-send-fid',
        registrationId: 'must-not-send-registration-id',
      },
    });

    expect(harness.fetchMock).toHaveBeenCalledWith('/api/public/push/receipt', expect.objectContaining({ method: 'POST' }));
    const [, receiptInit] = harness.fetchMock.mock.calls[0];
    expect(JSON.parse(receiptInit.body)).toEqual({ deliveryLogId: 'breaking-delivery-log-123', event: 'received' });
    expect(receiptInit.body).not.toContain('must-not-send-token');
    expect(receiptInit.body).not.toContain('must-not-send-fid');
    expect(receiptInit.body).not.toContain('must-not-send-registration-id');
    expect(harness.showNotification).toHaveBeenCalledWith('🔴 Breaking News', expect.objectContaining({
      body: 'breaking message',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      data: {
        url: 'https://www.newspulse.co.in/breaking/live-update',
        deliveryLogId: 'breaking-delivery-log-123',
        type: 'breaking',
      },
    }));
  });

  it('sends a received receipt and shows a background notification alert', async () => {
    const harness = createServiceWorkerHarness();
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      notification: { title: 'Article title', body: 'Article summary' },
      data: {
        deliveryLogId: 'delivery-log-123',
        type: 'article',
        url: '/news/article-slug',
        token: 'must-not-send-token',
        fid: 'must-not-send-fid',
      },
    });

    expect(harness.fetchMock).toHaveBeenCalledWith('/api/public/push/receipt', expect.objectContaining({ method: 'POST' }));
    const [, receiptInit] = harness.fetchMock.mock.calls[0];
    expect(JSON.parse(receiptInit.body)).toEqual({ deliveryLogId: 'delivery-log-123', event: 'received' });
    expect(receiptInit.body).not.toContain('must-not-send-token');
    expect(receiptInit.body).not.toContain('must-not-send-fid');
    expect(harness.showNotification).toHaveBeenCalledWith('News Pulse', expect.objectContaining({
      body: 'Article title',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      data: {
        url: 'https://www.newspulse.co.in/news/article-slug',
        deliveryLogId: 'delivery-log-123',
        type: 'article',
      },
    }));
  });

  it('sends a clicked receipt and opens only a safe News Pulse URL', async () => {
    const harness = createServiceWorkerHarness();
    let clickPromise = Promise.resolve();

    harness.listeners.notificationclick({
      notification: {
        close: jest.fn(),
        data: { url: 'https://www.newspulse.co.in/breaking/story', deliveryLogId: 'delivery-log-click', type: 'breaking' },
      },
      waitUntil: (promise) => {
        clickPromise = promise;
      },
    });
    await clickPromise;

    const [, receiptInit] = harness.fetchMock.mock.calls[0];
    expect(JSON.parse(receiptInit.body)).toEqual({ deliveryLogId: 'delivery-log-click', event: 'clicked' });
    expect(harness.openWindow).toHaveBeenCalledWith('https://www.newspulse.co.in/breaking/story');
  });

  it('falls back to the News Pulse home page for unsafe click URLs', async () => {
    const harness = createServiceWorkerHarness();
    let clickPromise = Promise.resolve();

    harness.listeners.notificationclick({
      notification: {
        close: jest.fn(),
        data: { url: 'https://example.com/phishing', deliveryLogId: 'delivery-log-click' },
      },
      waitUntil: (promise) => {
        clickPromise = promise;
      },
    });
    await clickPromise;

    expect(harness.openWindow).toHaveBeenCalledWith('https://www.newspulse.co.in/');
  });
});