const CACHE_STATIC = "medicare-static-v7";
const CACHE_PAGES = "medicare-pages-v7";
const CACHE_API = "medicare-api-v7";

const PRECACHE_STATIC = [
  "/manifest.webmanifest",
  "/Public/html/index.html",
  "/Public/html/carte.html",
  "/Public/html/recherchePharmacie.html",
  "/Public/html/rechercheMedicament.html",
  "/Public/html/pharmacieDetail.html",
  "/Public/html/offline.html",
  "/shared/icons/icon-192.png",
  "/shared/icons/icon-512.png",
  "/shared/icons/apple-touch-icon.png",
  "/shared/css/base.css",
  "/shared/css/layout.css",
  "/shared/css/map.css",
  "/shared/css/scrollHint.css",
  "/Public/css/style.css",
  "/shared/js/api.js",
  "/shared/js/medSearchFuzzy.js",
  "/shared/js/weeklyPharmacyHours.js",
  "/shared/js/common.js",
  "/shared/js/pwa.js",
  "/shared/js/pharmacyMap.js",
  "/shared/js/trackStats.js",
  "/Public/js/index.js",
  "/Public/js/searchPharmacyForm.js",
  "/Public/js/carte.js",
  "/Public/js/recherchePharmacie.js",
  "/Public/js/rechercheMedicament.js",
  "/Public/js/pharmacieDetail.js",
];

function isStaticAsset(pathname) {
  return /\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(pathname);
}

/** GET lecture seule — données consultables hors ligne après une visite en ligne. */
function isOfflineCacheableApi(pathname) {
  if (
    pathname === "/api/pharmacies" ||
    pathname === "/api/pharmacies/filtres" ||
    pathname === "/api/pharmacies/ville-auto" ||
    pathname === "/api/pharmacies/public-stats"
  )
    return true;
  if (/^\/api\/pharmacies\/\d+$/.test(pathname)) return true;
  if (/^\/api\/stock\/pharmacie\/\d+$/.test(pathname)) return true;
  if (pathname === "/api/medicaments/search") return true;
  if (pathname === "/api/favoris") return true;
  return false;
}

async function precacheUrls(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(
    urls.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        /* fichier absent ou hors ligne à l'install */
      }
    })
  );
}

async function putInCache(cacheName, request, response) {
  if (!response?.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

function offlineResponse(cached) {
  const headers = new Headers(cached.headers);
  headers.set("X-MediCare-Offline", "1");
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function networkFirstApi(request) {
  const cache = await caches.open(CACHE_API);
  try {
    const response = await fetch(request);
    if (response.ok) await putInCache(CACHE_API, request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return offlineResponse(cached);
    return Response.json(
      { error: "Hors ligne — aucune donnée en cache pour cette requête.", ok: false },
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) await putInCache(CACHE_PAGES, request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.match("/Public/html/offline.html");
    return shell || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) putInCache(CACHE_STATIC, request, response);
      return response;
    })
    .catch(() => null);
  return cached || network || fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheUrls(CACHE_STATIC, PRECACHE_STATIC).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([CACHE_STATIC, CACHE_PAGES, CACHE_API]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    if (!isOfflineCacheableApi(url.pathname)) return;
    event.respondWith(networkFirstApi(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstPage(event.request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
