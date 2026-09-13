// Background Push Notification Handler

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// Workbox precaching manifest injected by vite-plugin-pwa
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', function(event) {
  let data = {
    title: 'New Message',
    body: 'You have a new message'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error('Invalid push data:', error);
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {

      if (clientList.length > 0) {
        let client = clientList[0];

        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }

        return client.focus();
      }

      return clients.openWindow('/');
    })
  );
});
