// SPEED — Service Worker
// Estrategia: precache del "app shell" (index + apps hijas + manifest + íconos),
// y stale-while-revalidate para todo lo demás (fuentes, CDN, imágenes).
// Esto permite que la PWA abra offline y se instale correctamente.

const CACHE_VERSION = 'speed-cache-v1';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './IMAGES/Speed_Logo3.png',
    './IMAGES/Speed Logo.png',
    './APPS/OSINT.html',
    './APPS/KQL-template-builder.html',
    './APPS/Data_Normalizer.html',
    './APPS/Notes.html',
    './APPS/MITRE ATTACK.html',
    './APPS/CVE_WIN_PORT.html',
    './APPS/ProcessLookup.html',
    './APPS/Cybersecurity Dictionary Attacks.html',
    './APPS/StudyTracker.html',
    './APPS/PersonalNotes.html',
    './TEMPLATES/Launcher_Templates.html'
];

// --- Instalación: precache del shell ---
// IMPORTANTE: ya NO se llama self.skipWaiting() aquí a propósito.
// Esto hace que un Service Worker nuevo quede en estado "waiting" en vez
// de activarse solo — así el index.html puede mostrar el aviso "Nueva
// versión disponible" y activarlo recién cuando el usuario confirme.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // addAll falla entero si UN solo archivo 404 — los agregamos
            // uno por uno para que un archivo faltante no rompa el resto.
            return Promise.all(
                PRECACHE_URLS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] No se pudo precachear:', url, err);
                    })
                )
            );
        })
    );
});

// --- Mensaje desde la página: activar el SW en espera ---
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// --- Activación: limpiar caches viejos ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// --- Fetch: stale-while-revalidate ---
self.addEventListener('fetch', (event) => {
    // Solo GET; dejamos pasar POST/otros sin interceptar
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Solo cacheamos respuestas válidas (evita opaque de algunos CDN si fallan)
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse); // sin red: lo que haya en cache

                return cachedResponse || fetchPromise;
            })
        )
    );
});
