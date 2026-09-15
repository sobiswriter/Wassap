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

// Utility to split AI responses into authentic human-like chunks
const splitMessage = (text) => {
  if (!text) return [];

  const codeBlocks = [];
  const placeholderPrefix = "__CODE_BLOCK_";

  let processedText = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `${placeholderPrefix}${codeBlocks.length}__`;
    codeBlocks.push(match);
    return `\n\n${placeholder}\n\n`;
  });

  const rawChunks = processedText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const finalChunks = [];

  for (const rawChunk of rawChunks) {
    if (rawChunk.startsWith(placeholderPrefix)) {
      const match = rawChunk.match(/__CODE_BLOCK_(\d+)__/);
      if (match) {
        finalChunks.push(codeBlocks[parseInt(match[1], 10)]);
      }
      continue;
    }

    const words = rawChunk.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) continue;

    let targetChunksCount = 1;
    if (wordCount <= 8) {
      targetChunksCount = 1;
    } else if (wordCount <= 15) {
      targetChunksCount = 2;
    } else if (wordCount <= 24) {
      targetChunksCount = 3;
    } else {
      targetChunksCount = Math.random() > 0.5 ? 4 : 5;
    }

    if (targetChunksCount === 1) {
      finalChunks.push(rawChunk);
    } else {
      let currentSegment = [];
      const segmentList = [];

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        currentSegment.push(w);

        const isPunctuationEnd = /[.!?,\;:\-]+$/.test(w) || w.endsWith("...");
        const nextW = words[i+1] ? words[i+1].toLowerCase() : "";
        const isNextConjunction = ["and", "but", "so", "because", "then", "or"].includes(nextW);

        if (isPunctuationEnd || isNextConjunction) {
          segmentList.push(currentSegment.join(' '));
          currentSegment = [];
        }
      }
      if (currentSegment.length > 0) {
        segmentList.push(currentSegment.join(' '));
      }

      let localChunks = [];
      if (segmentList.length >= targetChunksCount) {
        const idealWordsPerChunk = Math.ceil(wordCount / targetChunksCount);
        let currentChunk = "";
        let currentWordCount = 0;

        for (let i = 0; i < segmentList.length; i++) {
          const seg = segmentList[i];
          const segWords = seg.split(/\s+/).length;

          if (currentChunk.length === 0) {
            currentChunk = seg;
            currentWordCount = segWords;
          } else {
            const chunksLeft = targetChunksCount - localChunks.length;
            const segmentsLeft = segmentList.length - i;

            if (segmentsLeft === chunksLeft - 1) {
              localChunks.push(currentChunk);
              currentChunk = seg;
              currentWordCount = segWords;
            } else if (currentWordCount >= idealWordsPerChunk) {
              localChunks.push(currentChunk);
              currentChunk = seg;
              currentWordCount = segWords;
            } else {
              currentChunk += " " + seg;
              currentWordCount += segWords;
            }
          }
        }
        if (currentChunk) localChunks.push(currentChunk);

        while (localChunks.length > targetChunksCount) {
          const last = localChunks.pop();
          if (last !== undefined) {
            localChunks[localChunks.length - 1] += " " + last;
          }
        }
      } else {
        const wordsPerChunk = Math.ceil(wordCount / targetChunksCount);
        let currChunk = [];

        for (let i = 0; i < words.length; i++) {
          currChunk.push(words[i]);
          if (currChunk.length >= wordsPerChunk && localChunks.length < targetChunksCount - 1) {
            localChunks.push(currChunk.join(' '));
            currChunk = [];
          }
        }
        if (currChunk.length > 0) {
          localChunks.push(currChunk.join(' '));
        }
      }

      finalChunks.push(...localChunks.filter(c => c.trim().length > 0));
    }
  }

  if (finalChunks.length > 0) {
    const totalWords = finalChunks.join(' ').split(/\s+/).filter(Boolean).length;
    let maxAllowed = 7;
    if (totalWords <= 25) maxAllowed = 4;
    else if (totalWords <= 50) maxAllowed = 5;
    else if (totalWords <= 100) maxAllowed = 6;
    else maxAllowed = 7;

    while (finalChunks.length > maxAllowed) {
      let minLen = Infinity;
      let mergeIdx = 0;
      for (let i = 0; i < finalChunks.length - 1; i++) {
        const combined = finalChunks[i].length + finalChunks[i+1].length;
        if (combined < minLen) {
          minLen = combined;
          mergeIdx = i;
        }
      }
      finalChunks.splice(mergeIdx, 2, finalChunks[mergeIdx] + ' ' + finalChunks[mergeIdx+1]);
    }
    return finalChunks;
  }

  return [text];
};

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
        // First check if an active app window is open to handle with full live in-memory React state
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientList && clientList.length > 0) {
          const client = clientList.find(c => c.visibilityState === 'visible' || c.focused) || clientList[0];
          if (client) {
            client.postMessage({
              type: 'INLINE_REPLY',
              chatId: targetChatId,
              text: replyText
            });
            return;
          }
        }

        // Otherwise, Service Worker autonomously handles the conversation reliably in background!
        try {
          // 1. Snappy reading delay that respects user's enableTextStacking setting
          const readingDelay = notifData.enableTextStacking === false
            ? 300 + Math.random() * 300
            : 900 + Math.random() * 600;
          await new Promise(r => setTimeout(r, readingDelay));

          const recent = notifData.recentMessages || [];
          const history = [
            ...recent,
            { text: replyText, sender: 'me', senderName: notifData.userName || 'You' }
          ];

          let replyContent = '';
          const provider = notifData.provider || 'vertex';
          const customApiKey = notifData.customApiKey;

          if (provider === 'custom' && customApiKey) {
            // Direct Gemini AI Studio call with full persona identity, user profile, and system prompt
            const model = notifData.model || 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${customApiKey}`;
            
            let promptToSend = '';
            if (notifData.fullSystemPrompt) {
              promptToSend = `${notifData.fullSystemPrompt}\n${notifData.userName || 'You'}: ${replyText}\n\nResponse as ${chatName}:`;
            } else {
              promptToSend = `${notifData.instruction || ''}\n\nUser: ${replyText}\n\nResponse as ${chatName}:`;
            }

            const apiRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptToSend }] }],
                generationConfig: { temperature: 0.85, maxOutputTokens: 800 }
              })
            });
            const apiJson = await apiRes.json();
            replyContent = apiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            // Vertex / Serverless Proxy Call with complete context
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
              userProfile: notifData.userProfile || {
                name: notifData.userName || 'You',
                about: notifData.userAbout || '',
                status: notifData.userStatus || 'Online'
              },
              groupContext: notifData.groupContext,
              settings: notifData.settings || {
                selectedModel: notifData.model,
                useSearchGrounding: notifData.useSearchGrounding,
                shareTimeContext: notifData.shareTimeContext !== false,
                shareCalendarNotes: notifData.shareCalendarNotes,
                calendarNotes: notifData.calendarNotes,
                clientTimeContext: notifData.clientTimeContext
              },
              clientTimeContext: notifData.clientTimeContext,
              initiationContext: notifData.timeGapContext,
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
            replyContent = "Got it! Talk soon.";
          }

          const cleanReply = replyContent.trim();

          // 2. FRAGMENTATION: Break reply into authentic WhatsApp message bubbles!
          const chunks = splitMessage(cleanReply);

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

          const personaReplies = [];

          // 3. Typing duration and sequential delivery for each fragment
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Snappy typing duration proportional to chunk length
            const typingDuration = notifData.enableTextStacking === false
              ? Math.min(Math.max(chunk.length * 10, 300), 800)
              : Math.min(Math.max(chunk.length * 16, 500), 1500);
            await new Promise(r => setTimeout(r, typingDuration));

            const personaMsg = {
              id: `${Date.now()}-${i}`,
              text: chunk,
              sender: 'other',
              senderName: chatName,
              timestamp: timeStr,
              status: 'read'
            };
            personaReplies.push(personaMsg);

            // Stack clean dialogue: user message + delivered persona fragments
            const stackedChunks = chunks.slice(0, i + 1).join('\n');
            const threadedBody = `${replyText}\n${stackedChunks}`;

            // Deliver notification update in shade with vibration and active Reply action
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
                recentMessages: [
                  ...history.slice(-35),
                  ...chunks.slice(0, i + 1).map(c => ({ text: c, sender: 'other', senderName: chatName }))
                ]
              },
              actions: [
                { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
                { action: 'read', title: 'Mark as read' }
              ]
            });

            // Snappy pause between consecutive message chunks
            if (i < chunks.length - 1) {
              const interPause = notifData.enableTextStacking === false
                ? 250 + Math.random() * 200
                : 400 + Math.random() * 300;
              await new Promise(r => setTimeout(r, interPause));
            }
          }

          // Save complete exchange with all fragmented messages into IndexedDB
          await saveBackgroundExchangeToIDB(targetChatId, userMsg, personaReplies);

          // Broadcast all fragmented messages to active window in real-time
          const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          clientList.forEach((client) => {
            try {
              client.postMessage({
                type: 'BACKGROUND_EXCHANGE_SYNC',
                chatId: targetChatId,
                userMessage: userMsg,
                personaReplies: personaReplies
              });
            } catch (e) {}
          });
        } catch (err) {
          console.error('SW: Autonomous reply handling failed:', err);
          await self.registration.showNotification(chatName, {
            body: `${replyText}\n(Message queued. Tap to open)`,
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
