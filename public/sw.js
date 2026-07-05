const APP_VERSION = "__APP_VERSION__";
const CACHE_NAME = "kaiju-v" + APP_VERSION;

const PRECACHE = [
    "/",
    "/index.html",
    "/manifest.json",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE).catch(() => {});
        }),
    );
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
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    // Navigations: always bypass browser HTTP cache to get fresh index.html
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request, { cache: "reload" })
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then(
                        (cached) => cached || caches.match("/index.html"),
                    );
                }),
        );
        return;
    }

    // Other requests: network-first with runtime caching
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return new Response("Offline", { status: 503 });
                });
            }),
    );
});
