/* simple, safe SW for Next.js */
const STATIC_CACHE = "np-static-v2";
const RUNTIME_CACHE = "np-runtime-v2";
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
  const accept = request.headers.get("accept") || "";

  // only GET
  if (request.method !== "GET") return;

  // Never cache EventSource/SSE streams.
  if (accept.includes("text/event-stream")) {
    e.respondWith(fetch(request));
    return;
  }

  // JSON/API/data requests should be network-first so language/cookie changes take effect immediately.
  // (Cache-first / SWR can keep serving the previous language until a hard refresh.)
  const isSameOrigin = url.origin === location.origin;
  const isJson = accept.includes("application/json") || url.pathname.endsWith(".json");
  const isApiOrData =
    isSameOrigin &&
    (url.pathname.startsWith("/api/") || url.pathname.startsWith("/public/") || url.pathname.startsWith("/_next/data/"));
  if (isApiOrData || isJson) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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
