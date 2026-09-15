// Wassap Service Worker v3: Offline PWA Shell, Low-Connectivity Resilience & Autonomous Notification Shade Conversations
const CACHE_NAME = 'wassap-shell-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/badge.svg',
  '/whatapp.wav'
];

// Offline DB details for background synchronization
const OFFLINE_DB_NAME = 'whatsapp_offline_db';
const OFFLINE_DB_VERSION = 1;
const SYNCED_BACKGROUND_STORE = 'synced_background';

const openOfflineDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_outbox')) {
        db.createObjectStore('pending_outbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SYNCED_BACKGROUND_STORE)) {
        db.createObjectStore(SYNCED_BACKGROUND_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveBackgroundExchangeToIDB = async (chatId, userMsg, personaReplies) => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SYNCED_BACKGROUND_STORE, 'readwrite');
    const store = tx.objectStore(SYNCED_BACKGROUND_STORE);
    store.put({
      id: userMsg.id || Date.now().toString(),
      chatId,
      userMessage: userMsg,
      personaReplies,
      timestamp: Date.now()
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('SW: Failed to save background exchange to IndexedDB:', err);
  }
};

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

  // 1. Never cache standard API requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // 2. Navigation requests: Network with 1.5s fast timeout, fallback to cached index.html
  // Guarantees instantaneous loading on offline or flaky/slow 2G/3G connections
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 1500)
          );
          const networkResponse = await Promise.race([fetch(event.request), timeoutPromise]);
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return networkResponse;
        } catch (e) {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return caches.match('/');
        }
      })()
    );
    return;
  }

  // 3. Static assets, fonts & Vite chunks: Stale-While-Revalidate with dynamic caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Native OS Notification Click & Continuous Inline Reply Handler
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const replyText = event.reply; // Text typed into native notification shade input
  const notifData = event.notification.data || {};
  const targetChatId = notifData.chatId || event.notification.tag || '';
  const chatName = notifData.chatName || event.notification.title || 'Contact';

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
    const squareIcon = event.notification.icon || '/favicon.svg';
    const badgeIcon = event.notification.badge || '/badge.svg';

    event.waitUntil(
      (async () => {
        // Immediate in-shade typing feedback! Keep notification alive with action buttons
        try {
          await self.registration.showNotification(chatName, {
            body: `You: "${replyText}"\n💬 ${chatName} is typing...`,
            icon: squareIcon,
            badge: badgeIcon,
            tag: targetChatId,
            renotify: false,
            silent: true,
            data: notifData,
            actions: [
              { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
              { action: 'read', title: 'Mark as read' }
            ]
          });
        } catch (e) {
          console.warn('SW: immediate typing notification failed:', e);
        }

        // Check if an app window is open in background
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientList.length > 0) {
          // App window is alive in the background: let it run the rich persona simulation & chunking!
          clientList.forEach((client) => {
            client.postMessage({
              type: 'INLINE_REPLY',
              chatId: targetChatId,
              text: replyText,
              keepBackground: true
            });
          });
          return;
        }

        // App window is CLOSED or killed: Service Worker autonomously handles the conversation!
        try {
          const recent = notifData.recentMessages || [];
          const history = [
            ...recent,
            { text: replyText, sender: 'me', senderName: 'You' }
          ];

          let replyContent = '';
          const provider = notifData.provider || 'vertex';
          const customApiKey = notifData.customApiKey;

          if (provider === 'custom' && customApiKey) {
            // Direct Gemini AI Studio call
            const model = notifData.model || 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${customApiKey}`;
            const contents = history.map(m => ({
              role: m.sender === 'me' ? 'user' : 'model',
              parts: [{ text: m.text }]
            }));
            const systemInstruction = notifData.instruction ? {
              parts: [{ text: notifData.instruction }]
            } : undefined;

            const apiRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                systemInstruction,
                generationConfig: { temperature: 0.85, maxOutputTokens: 800 }
              })
            });
            const apiJson = await apiRes.json();
            replyContent = apiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            // Vertex / Serverless Proxy Call
            const payload = {
              responder: {
                name: chatName,
                role: notifData.role,
                speechStyle: notifData.speechStyle,
                about: notifData.about,
                systemInstruction: notifData.instruction,
                humaneSettings: notifData.humaneSettings
              },
              messageHistory: history,
              userProfile: {
                name: notifData.userName || 'You',
                about: notifData.userAbout || ''
              },
              passcode: 'Ness2020'
            };

            const apiRes = await fetch('/api/gemini/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-vertex-passcode': 'Ness2020'
              },
              body: JSON.stringify(payload)
            });
            const apiJson = await apiRes.json();
            replyContent = apiJson.text || apiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }

          if (!replyContent || typeof replyContent !== 'string') {
            replyContent = "Got it! Let's talk soon.";
          }

          // Format current time
          const now = new Date();
          const hours = now.getHours();
          const minutes = now.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const formattedHours = hours % 12 || 12;
          const timeStr = `${formattedHours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;

          const userMsg = {
            id: Date.now().toString(),
            text: replyText,
            sender: 'me',
            timestamp: timeStr,
            status: 'sent'
          };

          const personaMsg = {
            id: (Date.now() + 1).toString(),
            text: replyContent.trim(),
            sender: 'other',
            senderName: chatName,
            timestamp: timeStr,
            status: 'read'
          };

          // Save to IndexedDB so React state will automatically reconcile when user launches app
          await saveBackgroundExchangeToIDB(targetChatId, userMsg, [personaMsg]);

          // Assemble multi-turn conversation thread for the notification body
          const threadedBody = `You: ${replyText}\n${chatName}: ${replyContent.trim()}`;

          const updatedRecent = [
            ...history.slice(-6),
            { text: replyContent.trim(), sender: 'other', senderName: chatName }
          ];

          // Re-issue notification in shade with persona's answer, vibration, and persistent reply action!
          await self.registration.showNotification(chatName, {
            body: threadedBody,
            icon: squareIcon,
            badge: badgeIcon,
            tag: targetChatId,
            renotify: true,
            silent: false,
            vibrate: [200, 100, 200],
            data: {
              ...notifData,
              recentMessages: updatedRecent
            },
            actions: [
              { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
              { action: 'read', title: 'Mark as read' }
            ]
          });
        } catch (err) {
          console.error('SW: Autonomous reply handling failed:', err);
          await self.registration.showNotification(chatName, {
            body: `You: "${replyText}"\n(Message queued. Tap to open)`,
            icon: squareIcon,
            badge: badgeIcon,
            tag: targetChatId,
            renotify: true,
            silent: false,
            actions: [
              { action: 'reply', title: 'Reply', type: 'text' },
              { action: 'read', title: 'Mark as read' }
            ]
          });
        }
      })()
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
