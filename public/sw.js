// Wassap Service Worker for background native OS notifications
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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (action === 'read') {
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({ type: 'MARK_AS_READ', chatId: chatId });
        }
        return;
      }

      // Default click or 'reply' action
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
