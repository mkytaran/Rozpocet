const CACHE_NAME = 'rozpocet-app-v5';
const APP_SHELL = ['index.html', 'style.css', 'script.js', 'manifest.json', 'icon.svg'];

function cacheKey(request) {
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    return url.href;
}

self.addEventListener('install', event => {
    const assets = APP_SHELL.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }));
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(assets))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith('rozpocet-app-') && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const key = cacheKey(request);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch(request, { cache: 'no-cache', signal: controller.signal });
            if (response.ok && response.type === 'basic') {
                await cache.put(key, response.clone());
            }
            if (request.mode === 'navigate' && response.status >= 500) {
                return await cache.match(key) || await cache.match(new URL('index.html', self.registration.scope)) || response;
            }
            return response;
        } catch {
            const cached = await cache.match(key);
            if (cached) return cached;
            if (request.mode === 'navigate') {
                return await cache.match(new URL('index.html', self.registration.scope)) || Response.error();
            }
            return Response.error();
        } finally {
            clearTimeout(timeout);
        }
    })());
});
