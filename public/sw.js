// Minimal service worker to enable PWA install prompt
const CACHE_NAME = "kaiju-v1";

const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/logo8-2.png",
    "/logo8-1.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Don't fail installation if some assets can't be cached
            });
        }),
    );
    // Activate immediately — don't wait for old tabs to close
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
            );
        }),
    );
    // Take control of all pages immediately
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Network-first strategy: try network, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful GET responses
                if (event.request.method === "GET" && response.status === 200) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cloned);
                    });
                }
                return response;
            })
            .catch(() => {
                // Offline fallback: try cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // If it's a page navigation, return index.html
                    if (event.request.mode === "navigate") {
                        return caches.match("/index.html");
                    }
                    return new Response("Offline", { status: 503 });
                });
            }),
    );
});
