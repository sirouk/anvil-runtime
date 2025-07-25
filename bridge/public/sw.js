// Service Worker for Anvil-NextJS Bridge PWA
const CACHE_NAME = 'anvil-bridge-v1';
const OFFLINE_URL = '/offline.html';

// URLs to cache for offline functionality
const CACHE_URLS = [
    '/',
    '/offline.html',
    '/_next/static/css/',
    '/_next/static/js/',
    '/api/health'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
    '/api/anvil-forms',
    '/api/anvil-config'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install event');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activate event');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Claim all clients immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle different types of requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
    } else if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(handleStaticAssets(request));
    } else if (url.pathname === '/' || url.pathname.startsWith('/form/')) {
        event.respondWith(handlePageRequest(request));
    } else {
        event.respondWith(handleOtherRequests(request));
    }
});

// Handle API requests with caching strategy
async function handleApiRequest(request) {
    const url = new URL(request.url);

    // Check if this API should be cached
    const shouldCache = API_CACHE_PATTERNS.some(pattern =>
        url.pathname.startsWith(pattern)
    );

    if (!shouldCache) {
        // For non-cacheable APIs, try network first, then return error
        try {
            return await fetch(request);
        } catch (error) {
            return new Response(
                JSON.stringify({
                    error: 'Offline',
                    message: 'This feature requires an internet connection'
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    }

    // Cache-first strategy for cacheable APIs
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            // Return cached version and update in background
            updateCacheInBackground(request, cache);
            return cachedResponse;
        }

        // No cache, try network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;

    } catch (error) {
        // Network failed, return error response
        return new Response(
            JSON.stringify({
                error: 'Offline',
                message: 'Unable to load data. Please check your connection.'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle static assets (CSS, JS) with cache-first strategy
async function handleStaticAssets(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;

    } catch (error) {
        console.error('Failed to fetch static asset:', request.url);
        throw error;
    }
}

// Handle page requests with network-first strategy
async function handlePageRequest(request) {
    try {
        // Try network first for pages
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }

        throw new Error('Network response not ok');

    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache, return offline page
        const offlineResponse = await cache.match(OFFLINE_URL);
        if (offlineResponse) {
            return offlineResponse;
        }

        // Fallback offline page
        return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Anvil Bridge</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
              text-align: center; 
              padding: 50px;
              background: #f5f5f5;
            }
            .offline-container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .offline-icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; line-height: 1.5; }
            button {
              background: #007bff;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="offline-icon">📱</div>
            <h1>You're Offline</h1>
            <p>
              This Anvil application requires an internet connection. 
              Please check your network connection and try again.
            </p>
            <button onclick="window.location.reload()">
              Try Again
            </button>
          </div>
        </body>
      </html>
    `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Handle other requests with network-first strategy
async function handleOtherRequests(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        throw error;
    }
}

// Update cache in background without affecting response
async function updateCacheInBackground(request, cache) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
    } catch (error) {
        // Silently fail - we already returned cached version
        console.log('Background cache update failed:', error);
    }
}

// Listen for skip waiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'anvil-form-sync') {
        event.waitUntil(syncAnvilForms());
    }
});

// Sync queued form submissions when online
async function syncAnvilForms() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const queuedRequests = await cache.match('offline-queue');

        if (queuedRequests) {
            const queue = await queuedRequests.json();

            for (const item of queue) {
                try {
                    await fetch(item.url, {
                        method: item.method,
                        headers: item.headers,
                        body: item.body
                    });
                } catch (error) {
                    console.error('Failed to sync form submission:', error);
                }
            }

            // Clear the queue
            await cache.delete('offline-queue');
        }
    } catch (error) {
        console.error('Form sync failed:', error);
    }
}

// Push notification handling (future enhancement)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();

        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: data.url ? { url: data.url } : null
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

console.log('Service Worker: Loaded and ready'); 