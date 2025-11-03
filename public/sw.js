// No-op service worker that immediately unregisters itself.
// This file is kept only to clean up any previously installed SW.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Remove any caches left by older versions
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {}
      try {
        await self.registration.unregister();
      } catch {}
      await self.clients.claim();
    })()
  );
});