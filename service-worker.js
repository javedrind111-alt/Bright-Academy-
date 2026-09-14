/**
 * Bright Academy — Service Worker
 * Caches the app shell (HTML/manifest/icons) for offline access and fast
 * repeat loads. Firebase/Firestore calls go straight to the network since
 * this app's live data (students, fees, attendance) must stay current —
 * only the static shell is cached.
 */

const CACHE_NAME = "bright-academy-cache-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Never intercept Firebase/Firestore/Auth calls or other cross-origin API
//   calls — always go to the network so data stays live.
// - For same-origin app-shell files: network-first, falling back to cache
//   (so updates are picked up when online, but the app still opens offline).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests for our own origin's shell files.
  const isSameOrigin = url.origin === self.location.origin;
  const isApiLike =
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebaseapp.com");

  if (req.method !== "GET" || !isSameOrigin || isApiLike) {
    return; // let the browser handle it normally
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return networkResponse;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
