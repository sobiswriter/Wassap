// Wassap Service Worker v9: Native Shade Replies, Left-on-Read Auto Reaction & Non-Dismissing Tray
const CACHE_NAME = 'wassap-shell-v9';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/badge.svg',
  '/whatapp.wav',
  '/msgsentpop.mp3'
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
      id: (userMsg && userMsg.id) ? userMsg.id : `left-read-${chatId}-${Date.now()}`,
      chatId,
      type: 'exchange',
      userMessage: userMsg || null,
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

const saveMarkAsReadToIDB = async (chatId) => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SYNCED_BACKGROUND_STORE, 'readwrite');
    const store = tx.objectStore(SYNCED_BACKGROUND_STORE);
    store.put({
      id: `mark-read-${chatId}-${Date.now()}`,
      chatId,
      type: 'MARK_AS_READ',
      timestamp: Date.now()
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('SW: Failed to save mark-as-read to IndexedDB:', err);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'reload' });
            if (response && (response.status === 200 || response.type === 'opaque')) {
              await cache.put(asset, response);
            }
          } catch (err) {
            console.warn('Pre-cache warning for ' + asset + ':', err);
          }
        })
      );
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

const isRawErrorMessage = (text) => {
  if (!text || typeof text !== 'string') return false;
  return (
    text.startsWith('Vertex AI error:') ||
    text.includes('"RESOURCE_EXHAUSTED"') ||
    text.includes('Please refer to https://cloud.google.com/vertex-ai') ||
    text.startsWith('{"error":') ||
    text.startsWith('Unable to connect to the built-in Vertex AI server') ||
    text.startsWith('Vertex AI server returned HTML or non-JSON')
  );
};

const getGlitchExcuse = (notifData, userLastText) => {
  const combinedContext = [
    notifData?.speechStyle || '',
    notifData?.about || '',
    notifData?.instruction || '',
    notifData?.chatName || '',
    userLastText || ''
  ].join(' ').toLowerCase();

  const isHinglish =
    /hinglish|hindi|desi|indian|urdu/i.test(combinedContext) ||
    /\b(hai|kya|toh|nahi|batao|kaho|arre|yaar|kar|rahe|tha|thi|the|mera|meri|tum|aap|haan|acha|mat|bhi|sach|kuch|kaise|suno|bolo|dekh|raha|rahi|samjhe|samjha|kumbhkaran)\b/i.test(combinedContext);

  const hinglishExcuses = [
    "Arre network issue ho gaya tha mere side se 😅 ek baar wapas bolo?",
    "Sry yaar, message glitch kar gaya tha shayad... kya keh rahe the?",
    "Arre wifi cut ho gaya tha ek sec ke liye! Kya bola tumne?",
    "Sorry phone thoda hang ho gaya tha mera abhi haha, kya bol rahe the wapas bhejna!",
    "Arey message theek se nahi aaya mere paas, firse bolo na?",
    "Sorry network drop ho gaya tha achanak se 🥲 wapas batao kya bola?"
  ];

  const englishExcuses = [
    "Sorry, my wifi just cut out for a second! 😅 What were you saying?",
    "Ugh, network glitch on my end! Could you say that again?",
    "Wait, my phone completely froze for a moment haha. What did you just text?",
    "Sorry, connection dropped for a sec! Send that again please?",
    "Argh my signal vanished for a moment! What were you saying?",
    "Sorry message didn't come through properly on my side, what was that?"
  ];

  const pool = isHinglish ? hinglishExcuses : englishExcuses;
  return pool[Math.floor(Math.random() * pool.length)];
};

// Autonomous Service Worker Persona Reply Synthesizer
const generateSWPersonaReply = async (notifData, history, promptOverride, replyText) => {
  let replyContent = '';
  const provider = notifData.provider || 'vertex';
  const customApiKey = notifData.customApiKey;
  const chatName = notifData.chatName || 'Contact';

  if (provider === 'custom' && customApiKey) {
    const model = notifData.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${customApiKey}`;
    
    let promptToSend = '';
    if (promptOverride) {
      promptToSend = `${notifData.fullSystemPrompt || notifData.instruction || ''}\n\n[CONTEXT]: ${promptOverride}\n\nResponse as ${chatName}:`;
    } else if (notifData.fullSystemPrompt) {
      promptToSend = `${notifData.fullSystemPrompt}\n${notifData.userName || 'You'}: ${replyText}\n\nResponse as ${chatName}:`;
    } else {
      promptToSend = `${notifData.instruction || ''}\n\nUser: ${replyText}\n\nResponse as ${chatName}:`;
    }

    try {
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
    } catch (e) {
      console.warn("SW custom API call failed", e);
    }
  } else {
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
      initiationContext: promptOverride || notifData.timeGapContext,
      passcode: 'Ness2020'
    };

    try {
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
    } catch (e) {
      console.warn("SW proxy call failed", e);
    }
  }

  if (!replyContent || typeof replyContent !== 'string' || isRawErrorMessage(replyContent)) {
    replyContent = getGlitchExcuse(notifData, replyText || promptOverride);
  }

  return replyContent.trim();
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
    const squareIcon = event.notification.icon || '/favicon.svg';
    const badgeIcon = event.notification.badge || '/badge.svg';
    const existingBody = event.notification.body || '';

    event.waitUntil(
      (async () => {
        // Save mark as read to IDB so it's guaranteed to sync even if app was sleeping/closed
        await saveMarkAsReadToIDB(targetChatId);

        // Update notification silently in place so it stays in the shade without popping out / buzzing immediately
        // and keeps the 'Reply' action ready for further texting
        await self.registration.showNotification(chatName, {
          body: existingBody ? `${existingBody} (Read)` : 'Marked as read',
          icon: squareIcon,
          badge: badgeIcon,
          tag: targetChatId,
          renotify: false,
          silent: true,
          data: {
            ...notifData,
            isMarkedAsRead: true
          },
          actions: [
            { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' }
          ]
        });

        // Notify all open clients immediately with fromNotification: true
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientList && clientList.length > 0) {
          clientList.forEach((client) => {
            client.postMessage({ type: 'MARK_AS_READ', chatId: targetChatId, fromNotification: true });
          });
          return;
        }

        // If NO clients are open (app completely closed), SW autonomously handles Left on Read!
        if (notifData && !notifData.isGroup) {
          const recent = (notifData.recentMessages || []).filter(m => !isRawErrorMessage(m?.text));
          const lastMsg = recent[recent.length - 1];
          if (lastMsg && lastMsg.sender === 'other') {
            // Natural hesitation delay before reacting (6-10s)
            await new Promise(r => setTimeout(r, 6500 + Math.random() * 3500));

            // Generate Left on Read in-character response
            const leftOnReadPrompt = `[LEFT ON READ] The user just saw your last message ("${(lastMsg.text || '').slice(0, 50)}") and marked it as read (blue ticks) but did NOT send a reply back. React naturally in character to being left on read in 1 short message.`;
            const replyContent = await generateSWPersonaReply(notifData, recent, leftOnReadPrompt, undefined);

            const chunks = splitMessage(replyContent);
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            const timeStr = `${formattedHours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;

            const personaReplies = [];
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const personaMsg = {
                id: `${Date.now()}-${i}`,
                text: chunk,
                sender: 'other',
                senderName: chatName,
                timestamp: timeStr,
                status: 'read'
              };
              personaReplies.push(personaMsg);

              const stackedChunks = chunks.slice(0, i + 1).join('\n');
              const recentTurns = (existingBody ? existingBody.split('\n') : []).slice(-4);
              recentTurns.push(`${chatName}: ${stackedChunks}`);
              const threadedBody = recentTurns.join('\n');

              // The first chunk POPS UP as a new native notification with sound/vibration!
              await self.registration.showNotification(chatName, {
                body: threadedBody,
                icon: squareIcon,
                badge: badgeIcon,
                tag: targetChatId,
                renotify: (i === 0),
                silent: (i > 0),
                vibrate: (i === 0) ? [200, 100, 200] : undefined,
                data: {
                  ...notifData,
                  recentMessages: [
                    ...recent.slice(-45),
                    ...chunks.slice(0, i + 1).map(c => ({ text: c, sender: 'other', senderName: chatName }))
                  ]
                },
                actions: [
                  { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
                  { action: 'read', title: 'Mark as read' }
                ]
              });

              if (i < chunks.length - 1) {
                await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
              }
            }

            // Save exchange to IDB
            await saveBackgroundExchangeToIDB(targetChatId, null, personaReplies);
          }
        }
      })()
    );
    return;
  }

  // 2. User submitted an inline reply directly in the OS notification shade
  if (replyText) {
    const squareIcon = event.notification.icon || '/favicon.svg';
    const badgeIcon = event.notification.badge || '/badge.svg';
    const previousBody = event.notification.body || '';
    const updatedBodyWithUser = previousBody ? `${previousBody}\nYou: ${replyText}` : `You: ${replyText}`;

    event.waitUntil(
      (async () => {
        // Immediately update notification in shade silently to reflect user's input and keep it anchored
        await self.registration.showNotification(chatName, {
          body: updatedBodyWithUser,
          icon: squareIcon,
          badge: badgeIcon,
          tag: targetChatId,
          renotify: false,
          silent: true,
          data: {
            ...notifData,
            lastUserReply: replyText
          },
          actions: [
            { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
            { action: 'read', title: 'Mark as read' }
          ]
        });

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

          const recent = (notifData.recentMessages || []).filter(m => !isRawErrorMessage(m?.text));
          const history = [
            ...recent,
            { text: replyText, sender: 'me', senderName: notifData.userName || 'You' }
          ];

          const cleanReply = await generateSWPersonaReply(notifData, history, undefined, replyText);

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
            const recentTurns = (previousBody ? previousBody.split('\n') : []).slice(-4);
            recentTurns.push(`You: ${replyText}`);
            recentTurns.push(`${chatName}: ${stackedChunks}`);
            const threadedBody = recentTurns.join('\n');

            // Deliver notification: first chunk POPS UP as a new native notification with sound/vibration!
            await self.registration.showNotification(chatName, {
              body: threadedBody,
              icon: squareIcon,
              badge: badgeIcon,
              tag: targetChatId,
              renotify: (i === 0),
              silent: (i > 0),
              vibrate: (i === 0) ? [200, 100, 200] : undefined,
              data: {
                ...notifData,
                recentMessages: [
                  ...history.slice(-45),
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
          const excuse = getGlitchExcuse(notifData, replyText);
          await self.registration.showNotification(chatName, {
            body: excuse,
            icon: squareIcon,
            badge: badgeIcon,
            tag: targetChatId,
            renotify: false,
            silent: true,
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
