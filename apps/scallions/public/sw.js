const CACHE_NAME = 'scallions-cache-v1'

const PRECACHE_URLS = [
  './',
  './favicon.jpg',
  './bookmark-preview.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Cache Google Fonts (CSS & woff2) and app assets
  const isGoogleFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')
  const isStaticAsset = url.pathname.includes('/assets/') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')

  if (isGoogleFont || isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response immediately, update cache in background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse))
            }
          }).catch(() => {/* ignore network errors when offline */})
          return cachedResponse
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
          }
          return networkResponse
        })
      })
    )
  }
})
