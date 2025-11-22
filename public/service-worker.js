/* simple, safe SW for Next.js */
const STATIC_CACHE = "np-static-v1";
const RUNTIME_CACHE = "np-runtime-v1";
const STATIC_ASSETS = ["/", "/offline", "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Cache-first for static, SWR for pages/API/images */
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // only GET
  if (request.method !== "GET") return;

  // HTML pages → network first, fallback offline
  if (request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => caches.match(request).then(r => r || caches.match("/offline")))
    );
    return;
  }

  // static assets → cache first
  if (url.origin === location.origin && url.pathname.match(/\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|webp)$/)) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // everything else → stale-while-revalidate
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
