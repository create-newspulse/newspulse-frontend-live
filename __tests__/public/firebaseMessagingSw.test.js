const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createServiceWorkerHarness(options = {}) {
  const listeners = {};
  const cache = {
    match: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
  };
  const showNotification = jest.fn(options.showNotificationImplementation || (() => Promise.resolve(undefined)));
  const fetchMock = jest.fn(options.fetchImplementation || (() => Promise.resolve({ ok: true, status: 200 })));
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

function getReceiptBodies(fetchMock) {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
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

  it('sends received and shown receipts and shows a breaking background notification alert', async () => {
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
    const receipts = getReceiptBodies(harness.fetchMock);
    expect(receipts).toEqual([
      { deliveryLogId: 'breaking-delivery-log-123', event: 'received' },
      { deliveryLogId: 'breaking-delivery-log-123', event: 'shown' },
    ]);
    expect(JSON.stringify(receipts)).not.toContain('must-not-send-token');
    expect(JSON.stringify(receipts)).not.toContain('must-not-send-fid');
    expect(JSON.stringify(receipts)).not.toContain('must-not-send-registration-id');
    expect(harness.showNotification).toHaveBeenCalledWith('🔴 Breaking News', expect.objectContaining({
      body: 'breaking message',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      tag: expect.stringMatching(/^news-pulse-breaking-[a-z0-9]+$/),
      renotify: false,
      data: {
        url: 'https://www.newspulse.co.in/breaking/live-update',
        deliveryLogId: 'breaking-delivery-log-123',
        type: 'breaking',
      },
    }));
  });

  it('sends received and shown receipts and shows a background notification alert', async () => {
    const harness = createServiceWorkerHarness();
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      notification: { title: 'Article title', body: 'Article summary' },
      data: {
        deliveryLogId: 'delivery-log-123',
        type: 'article',
        url: '/news/article-slug',
        slug: 'article-slug',
        token: 'must-not-send-token',
        fid: 'must-not-send-fid',
      },
    });

    expect(harness.fetchMock).toHaveBeenCalledWith('/api/public/push/receipt', expect.objectContaining({ method: 'POST' }));
    const receipts = getReceiptBodies(harness.fetchMock);
    expect(receipts).toEqual([
      { deliveryLogId: 'delivery-log-123', event: 'received' },
      { deliveryLogId: 'delivery-log-123', event: 'shown' },
    ]);
    expect(JSON.stringify(receipts)).not.toContain('must-not-send-token');
    expect(JSON.stringify(receipts)).not.toContain('must-not-send-fid');
    expect(harness.showNotification).toHaveBeenCalledWith('News Pulse', expect.objectContaining({
      body: 'Article title',
      icon: '/icons/news-pulse-icon-192.png',
      badge: '/icons/news-pulse-badge-72.png',
      tag: 'news-pulse-article-article-slug',
      renotify: false,
      data: {
        url: 'https://www.newspulse.co.in/news/article-slug',
        deliveryLogId: 'delivery-log-123',
        type: 'article',
      },
    }));
  });

  it('handles a raw background push event when Firebase config has not been posted yet', async () => {
    const harness = createServiceWorkerHarness();
    let pushPromise = Promise.resolve();

    harness.listeners.push({
      data: {
        json: () => ({
          data: {
            deliveryLogId: 'raw-push-delivery-log-123',
            type: 'article',
            title: 'Raw article title',
            body: 'Raw article body',
            url: '/news/raw-push-story',
          },
        }),
      },
      waitUntil: (promise) => {
        pushPromise = promise;
      },
    });
    await pushPromise;

    expect(getReceiptBodies(harness.fetchMock)).toEqual([
      { deliveryLogId: 'raw-push-delivery-log-123', event: 'received' },
      { deliveryLogId: 'raw-push-delivery-log-123', event: 'shown' },
    ]);
    expect(harness.showNotification).toHaveBeenCalledWith('News Pulse', expect.objectContaining({
      body: 'Raw article title',
      tag: 'news-pulse-article-raw-push-story',
      renotify: false,
      data: {
        deliveryLogId: 'raw-push-delivery-log-123',
        type: 'article',
        url: 'https://www.newspulse.co.in/news/raw-push-story',
      },
    }));
  });

  it('starts notification display before receipt work and sends shown after display resolves', async () => {
    const sequence = [];
    const harness = createServiceWorkerHarness({
      fetchImplementation: (_url, init) => {
        sequence.push(JSON.parse(init.body).event);
        return Promise.resolve({ ok: true, status: 200 });
      },
      showNotificationImplementation: () => Promise.resolve().then(() => {
        sequence.push('showNotification resolved');
      }),
    });
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'ordered-delivery-log-123',
        type: 'article',
        title: 'Ordered article title',
        url: '/news/ordered-story',
      },
    });

    expect(sequence).toEqual(['showNotification resolved', 'received', 'shown']);
  });

  it('does not let a slow received receipt block visible notification display', async () => {
    let resolveReceivedReceipt;
    const receivedReceiptPromise = new Promise((resolve) => {
      resolveReceivedReceipt = () => resolve({ ok: true, status: 200 });
    });
    const harness = createServiceWorkerHarness({
      fetchImplementation: (_url, init) => {
        const event = JSON.parse(init.body).event;
        if (event === 'received') return receivedReceiptPromise;
        return Promise.resolve({ ok: true, status: 200 });
      },
    });
    await initializeFirebaseMessaging(harness);

    const handlerPromise = harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'slow-receipt-delivery-log-123',
        type: 'article',
        title: 'Slow receipt article title',
        url: '/news/slow-receipt-story',
      },
    });

    await Promise.resolve();
    expect(harness.showNotification).toHaveBeenCalledWith('News Pulse', expect.objectContaining({
      body: 'Slow receipt article title',
    }));
    resolveReceivedReceipt();
    await handlerPromise;
  });

  it('sends display_failed when showNotification rejects', async () => {
    const harness = createServiceWorkerHarness({
      showNotificationImplementation: () => Promise.reject(new Error('display failed')),
    });
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'failed-display-delivery-log-123',
        type: 'article',
        title: 'Failed display article',
        url: '/news/failed-display-story',
      },
    });

    expect(getReceiptBodies(harness.fetchMock)).toEqual([
      { deliveryLogId: 'failed-display-delivery-log-123', event: 'received' },
      { deliveryLogId: 'failed-display-delivery-log-123', event: 'display_failed' },
    ]);
  });

  it('uses a stable hashed breaking tag so duplicate breaking notifications replace instead of stacking', async () => {
    const harness = createServiceWorkerHarness();
    await initializeFirebaseMessaging(harness);

    await harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'breaking-delivery-log-1',
        type: 'breaking',
        url: '/breaking/live-update',
        message: 'same breaking message',
      },
    });
    await harness.getBackgroundHandler()({
      data: {
        deliveryLogId: 'breaking-delivery-log-2',
        type: 'breaking',
        url: '/breaking/live-update',
        message: 'same breaking message',
      },
    });

    const firstOptions = harness.showNotification.mock.calls[0][1];
    const secondOptions = harness.showNotification.mock.calls[1][1];
    expect(firstOptions.tag).toMatch(/^news-pulse-breaking-[a-z0-9]+$/);
    expect(secondOptions.tag).toBe(firstOptions.tag);
    expect(firstOptions.renotify).toBe(false);
    expect(secondOptions.renotify).toBe(false);
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

  it('falls back to the News Pulse home page for non-HTTPS News Pulse click URLs', async () => {
    const harness = createServiceWorkerHarness();
    let clickPromise = Promise.resolve();

    harness.listeners.notificationclick({
      notification: {
        close: jest.fn(),
        data: { url: 'http://newspulse.co.in/breaking/story', deliveryLogId: 'delivery-log-click' },
      },
      waitUntil: (promise) => {
        clickPromise = promise;
      },
    });
    await clickPromise;

    expect(harness.openWindow).toHaveBeenCalledWith('https://www.newspulse.co.in/');
  });
});