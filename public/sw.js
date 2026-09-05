// Wassap Service Worker for offline app shell and background native OS notifications
const CACHE_NAME = 'wassap-shell-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/whatapp.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache API requests (Gemini AI and proxy calls must always be live)
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // 2. Navigation requests: Network-first, fallback to cached index.html for SPA routing
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 3. Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const chatId = event.notification.tag;
  const action = event.action;
  const replyText = event.reply; // Text typed into notification shade inline input

  // Only close notification on explicit 'MARK AS READ' action
  if (action === 'read' || action === 'mark_read') {
    event.notification.close();
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. User typed an inline reply directly in native notification shade
      if (replyText) {
        if (clientList.length > 0) {
          let focusedClient = null;
          for (let i = 0; i < clientList.length; i++) {
            clientList[i].postMessage({ type: 'INLINE_REPLY', chatId: chatId, text: replyText });
            if ('focus' in clientList[i]) {
              focusedClient = clientList[i];
            }
          }
          if (focusedClient) {
            return focusedClient.focus();
          }
        } else if (clients.openWindow) {
          const url = '/?chatId=' + encodeURIComponent(chatId || '') + '&replyText=' + encodeURIComponent(replyText);
          return clients.openWindow(url);
        }
        return;
      }

      // 2. User tapped 'MARK AS READ' button
      if (action === 'read' || action === 'mark_read') {
        if (clientList.length > 0) {
          for (let i = 0; i < clientList.length; i++) {
            clientList[i].postMessage({ type: 'MARK_AS_READ', chatId: chatId });
          }
        }
        return;
      }

      // 3. User tapped 'REPLY' button or notification card body -> Open/Focus chat window
      if (clientList.length > 0) {
        let focusedClient = null;
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({ type: 'OPEN_CHAT', chatId: chatId });
          if ('focus' in clientList[i]) {
            focusedClient = clientList[i];
          }
        }
        if (focusedClient) {
          return focusedClient.focus();
        }
      } else if (clients.openWindow) {
        const url = '/?chatId=' + encodeURIComponent(chatId || '');
        return clients.openWindow(url);
      }
    })
  );
});


