// Service worker for the offline stall app (/stall).
// It keeps a copy of the page and its files on the device, so the app opens without internet.
// Orders themselves are kept by the page in the browser's storage, not here.
const CACHE = "pg-stall-v1";
const PAGE = "/stall";

/** Every file path under /_next/static/ that a page mentions. */
function assetsIn(html) {
  const found = html.match(/\/_next\/static\/[^"'\\\s<>)]+/g) || [];
  return [...new Set(found)];
}

/** Save a fresh copy of the page, but only after its files are saved too, so an offline start never misses a file. */
async function refreshPage() {
  const res = await fetch(PAGE, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok || res.redirected) return res;
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await Promise.all(
    assetsIn(html).map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const asset = await fetch(url);
        if (asset.ok) await cache.put(url, asset);
      } catch {
        // Not reachable right now; it is fetched the next time the page is opened online.
      }
    }),
  );
  await cache.put(PAGE, res.clone());
  return res;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(refreshPage().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pg-stall-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page tells the worker which files it loaded, so they are saved even on the very first visit.
self.addEventListener("message", (event) => {
  const urls = event.data && event.data.type === "precache" ? event.data.urls : null;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        urls.map(async (url) => {
          if (await cache.match(url)) return;
          try {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          } catch {
            // ignore
          }
        }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Data always comes from the network; the page handles being offline itself.
  if (url.pathname.startsWith("/api/")) return;

  // The stall page: show the saved copy at once, and fetch a newer one in the background.
  if (req.mode === "navigate") {
    if (url.pathname !== PAGE) return;
    event.respondWith(
      caches.match(PAGE).then((cached) => {
        const fresh = refreshPage().catch(() => cached);
        if (cached) {
          event.waitUntil(fresh);
          return cached;
        }
        return fresh;
      }),
    );
    return;
  }

  // Files of the app never change under the same name, so a saved copy is always right.
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
