// Service worker di VaultForge: rende l'app utilizzabile offline.
// La versione arriva da APP_VERSION in main.py.
const CACHE = "vaultforge-{{ version }}";
const ASSETS = [
  "/",
  "/api",
  "/static/css/fonts.css?v={{ version }}",
  "/static/css/app.css?v={{ version }}",
  "/static/js/wordlist-it.js?v={{ version }}",
  "/static/js/app.js?v={{ version }}",
  "/manifest.webmanifest",
  "/static/icons/icon.svg",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/favicon-32.png",
  "/static/icons/apple-touch-icon.png",
  "/static/fonts/fraunces-latin.woff2",
  "/static/fonts/fraunces-italic-latin.woff2",
  "/static/fonts/inter-latin.woff2",
  "/static/fonts/jetbrains-mono-latin.woff2",
];
// Pagine servite "prima la rete, poi la cache" (per avere sempre la versione nuova).
const PAGES = ["/", "/api"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("vaultforge-") && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Pagina: prima la rete (per avere la versione nuova), poi la cache se offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && PAGES.includes(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() => caches.match(PAGES.includes(url.pathname) ? url.pathname : "/"))
    );
    return;
  }

  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
