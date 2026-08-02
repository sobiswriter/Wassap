// Wassap Service Worker for background native OS notifications with inline reply support
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
      // 1. User typed an inline reply directly in notification shade
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
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({ type: 'MARK_AS_READ', chatId: chatId });
        }
        return;
      }

      // 3. User tapped 'REPLY' button or clicked notification card body -> Open chat window
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
