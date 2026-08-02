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
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({ type: 'INLINE_REPLY', chatId: chatId, text: replyText });
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
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) {
          if (chatId) {
            client.postMessage({ type: 'OPEN_CHAT', chatId: chatId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
