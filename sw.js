// RETIRED service worker (passive kill switch).
// The PWA cache served stale pages; this worker takes over the old one, deletes every
// cache, and unregisters itself. It deliberately does NOT reload tabs (an auto-reload
// could bounce into a refresh loop on devices still holding old assets in HTTP cache).
// No caching, no offline, no fetch handler -> all requests go straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
    await self.registration.unregister();
  })());
});
