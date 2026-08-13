// Wassap Service Worker for background native OS notifications with seamless inline reply support
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const chatId = event.notification.tag;
  const action = event.action;
  const replyText = event.reply; // Text typed into notification shade inline input

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. User typed an inline reply directly in native notification shade
      if (replyText) {
        if (clientList.length > 0) {
          for (let i = 0; i < clientList.length; i++) {
            clientList[i].postMessage({ type: 'INLINE_REPLY', chatId: chatId, text: replyText });
          }
          // Intentionally do NOT call focus() or openWindow()!
          // This keeps the user in their current context while continuing the conversation via notifications.
        } else {
          // If no window is active, queue inline reply in localStorage/indexedDB fallback if available
          try {
            const pendingQueue = JSON.parse(localStorage.getItem('wassap_pending_replies') || '[]');
            pendingQueue.push({ chatId, text: replyText, timestamp: Date.now() });
            localStorage.setItem('wassap_pending_replies', JSON.stringify(pendingQueue));
          } catch (e) {
            console.warn('SW failed to queue inline reply offline', e);
          }
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

      // 3. User tapped 'REPLY' button action (OS is opening inline input shade)
      if (action === 'reply') {
        // Do NOT open app window when clicking the 'Reply' button!
        // The OS will present the native inline text box for typing.
        return;
      }

      // 4. User clicked the main notification card body -> Open/Focus chat window
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

