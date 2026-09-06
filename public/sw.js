// Wassap Service Worker for offline app shell and background native OS notifications
const CACHE_NAME = 'wassap-shell-v2';
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

// Native OS Notification Click & Inline Reply Handler
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const replyText = event.reply; // Text typed into native notification shade input
  const notifData = event.notification.data || {};
  const targetChatId = notifData.chatId || event.notification.tag || '';

  // 1. User tapped 'MARK AS READ'
  if (action === 'read' || action === 'mark_read') {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'MARK_AS_READ', chatId: targetChatId });
        });
      })
    );
    return;
  }

  // 2. User submitted an inline reply directly in the OS notification shade
  if (replyText) {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Broadcast the inline reply to the background window/tab to process naturally
        // Schemeless & background: DO NOT focus or bring window to foreground!
        clientList.forEach((client) => {
          client.postMessage({
            type: 'INLINE_REPLY',
            chatId: targetChatId,
            text: replyText,
            keepBackground: true
          });
        });
      })
    );
    return;
  }

  // 3. User tapped the notification card body -> Open & Focus chat window directly to the persona
  event.waitUntil(
    (async () => {
      const targetUrl = targetChatId ? `/?chatId=${encodeURIComponent(targetChatId)}` : '/';
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      // If app window is already open, focus it and switch to the target chat
      for (const client of clientList) {
        client.postMessage({ type: 'OPEN_CHAT', chatId: targetChatId });
        if ('focus' in client) {
          event.notification.close();
          await client.focus();
          setTimeout(() => {
            try {
              client.postMessage({ type: 'OPEN_CHAT', chatId: targetChatId });
            } catch (e) {}
          }, 100);
          return;
        }
      }

      // If no window is open, open a new window pointing directly to the persona
      event.notification.close();
      if (clients.openWindow) {
        const newClient = await clients.openWindow(targetUrl);
        if (newClient) {
          setTimeout(() => {
            try {
              newClient.postMessage({ type: 'OPEN_CHAT', chatId: targetChatId });
            } catch (e) {}
          }, 500);
        }
      }
    })()
  );
});



