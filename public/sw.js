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

// IndexedDB helper for headless background message sync
const DB_NAME = 'whatsapp_media_db';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('media_store')) {
        db.createObjectStore('media_store', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('synced_chats')) {
        db.createObjectStore('synced_chats', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePendingMessage(chatId, message) {
  try {
    const db = await openDB();
    const tx = db.transaction(['pending_messages'], 'readwrite');
    const store = tx.objectStore('pending_messages');
    await new Promise((resolve, reject) => {
      const req = store.put({
        id: 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        chatId: chatId,
        message: message,
        createdAt: Date.now()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SW] Failed to save pending message to IndexedDB:', err);
  }
}

async function handleHeadlessNotificationReply(chatId, replyText, notifData) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${hours}:${minutes}`;
  const dateKey = now.toISOString().split('T')[0];

  // 1. Save user's inline reply message to IndexedDB
  const userMsg = {
    id: 'user-headless-' + Date.now(),
    text: replyText,
    sender: 'me',
    date: dateKey,
    timestamp: timestamp,
    timestampEpoch: Date.now(),
    status: 'sent'
  };
  await savePendingMessage(chatId, userMsg);

  // 2. Prepare context for Gemini AI
  const history = Array.isArray(notifData.recentMessages) ? [...notifData.recentMessages] : [];
  history.push({
    text: replyText,
    sender: 'me',
    senderName: notifData.userName || 'You'
  });

  const personaName = notifData.chatName || 'Persona';
  const avatar = notifData.chatAvatar || '/favicon.svg';
  const isVertex = notifData.provider !== 'custom';
  let responseText = '';

  try {
    if (isVertex) {
      // Call built-in Vertex AI endpoint via Vercel serverless function
      const payload = {
        responder: {
          name: personaName,
          role: notifData.role || '',
          speechStyle: notifData.speechStyle || '',
          about: notifData.about || '',
          systemInstruction: notifData.instruction || '',
          humaneSettings: notifData.humaneSettings || {}
        },
        messageHistory: history.slice(-20),
        userProfile: {
          name: notifData.userName || 'User',
          about: notifData.userAbout || ''
        },
        settings: {
          selectedModel: notifData.model || 'gemini-3.8-flash'
        }
      };

      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vertex-passcode': 'Ness2020'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          responseText = data.text;
        }
      }
    } else if (notifData.customApiKey) {
      // Direct call to Gemini REST API for custom API key
      const model = notifData.model || 'gemini-2.5-flash';
      const promptParts = [];
      if (notifData.instruction) {
        promptParts.push({ text: `System Instruction: You are roleplaying as ${personaName}. ${notifData.instruction}` });
      }
      history.slice(-15).forEach(m => {
        promptParts.push({ text: `${m.sender === 'me' ? 'User' : personaName}: ${m.text}` });
      });

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${notifData.customApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: promptParts }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          responseText = candidateText;
        }
      }
    }
  } catch (apiErr) {
    console.error('[SW] Headless AI fetch failed:', apiErr);
  }

  // 3. Clean up spoken tags if any
  if (!responseText) {
    responseText = "Got your message!";
  }
  responseText = responseText.replace(/\[laughs?\]/gi, '').replace(/\[sighs?\]/gi, '').replace(/\[whispers?\]/gi, '').trim();

  // 4. Save persona's AI reply to IndexedDB
  const aiMsg = {
    id: 'ai-headless-' + Date.now(),
    text: responseText,
    sender: 'other',
    senderName: personaName,
    date: dateKey,
    timestamp: timestamp,
    timestampEpoch: Date.now(),
    status: 'delivered'
  };
  await savePendingMessage(chatId, aiMsg);

  // 5. Update history for continuous next notification reply action
  const updatedHistory = [...history, { text: responseText, sender: 'other', senderName: personaName }];
  const newNotifData = {
    ...notifData,
    recentMessages: updatedHistory.slice(-8)
  };

  // 6. Display the persona's reply notification directly from Service Worker
  await self.registration.showNotification(personaName, {
    body: responseText,
    icon: avatar,
    tag: chatId,
    badge: '/badge.svg',
    data: newNotifData,
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
      { action: 'read', title: 'Mark as read' }
    ]
  });
}

self.addEventListener('notificationclick', (event) => {
  const chatId = event.notification.tag;
  const action = event.action;
  const replyText = event.reply; // Text typed into notification shade inline input
  const notifData = event.notification.data || {};

  // 1. User tapped 'MARK AS READ' button
  if (action === 'read' || action === 'mark_read') {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          for (let i = 0; i < clientList.length; i++) {
            clientList[i].postMessage({ type: 'MARK_AS_READ', chatId: chatId });
          }
        }
      })
    );
    return;
  }

  // 2. User typed an inline reply directly in native notification shade
  if (replyText) {
    // Immediately close notification so notification shade clears cleanly without hanging
    event.notification.close();

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
        // Mode A: Active window exists (tab running in background or minimized)
        if (clientList.length > 0) {
          for (let i = 0; i < clientList.length; i++) {
            clientList[i].postMessage({
              type: 'INLINE_REPLY',
              chatId: chatId,
              text: replyText,
              keepBackground: true
            });
          }
          // Schemeless & background: DO NOT focus or bring window to foreground!
          return;
        }

        // Mode B: Headless Background execution (app window is closed)
        try {
          await handleHeadlessNotificationReply(chatId, replyText, notifData);
        } catch (err) {
          console.error('[SW] Headless notification reply error:', err);
        }
      })
    );
    return;
  }

  // 3. User tapped the notification card body or a regular open button -> Open/Focus chat window
  event.notification.close();
  const targetChatId = (event.notification.data && event.notification.data.chatId) || event.notification.tag || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let focusedClient = null;
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({ type: 'OPEN_CHAT', chatId: targetChatId });
          if ('focus' in clientList[i]) {
            focusedClient = clientList[i];
          }
        }
        if (focusedClient) {
          // Re-send shortly after focusing so backgrounded/suspended tabs receive it once active
          setTimeout(() => {
            try {
              focusedClient.postMessage({ type: 'OPEN_CHAT', chatId: targetChatId });
            } catch (e) {}
          }, 150);
          return focusedClient.focus();
        }
      } else if (clients.openWindow) {
        const url = '/?chatId=' + encodeURIComponent(targetChatId || '');
        return clients.openWindow(url);
      }
    })
  );
});



