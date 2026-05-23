// Quorum Service Worker
//
// Phase 2: minimal — registration confirmation + network-first
// passthrough. No aggressive caching yet because the app is still
// changing rapidly and stale shells would mislead.
//
// Phase 4 will extend this with `push` and `notificationclick`
// handlers for daily digest delivery.

const VERSION = "quorum-sw-v1"

self.addEventListener("install", (event) => {
  // Take over from any previous SW immediately on update.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up any caches left over from previous SW versions.
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  // Pass-through. We intentionally don't cache yet — Quorum is a
  // network-required app (every query hits the API) and stale
  // shells would create confusing UX. Cache strategy lands once
  // the app stabilizes.
  // Leaving the handler in place ensures the SW is "active" and
  // ready for push events in Phase 4.
})

// Phase 4 placeholders — uncomment + implement when push lands.
//
// self.addEventListener("push", (event) => {
//   const data = event.data?.json() ?? {}
//   event.waitUntil(
//     self.registration.showNotification(data.title ?? "Quorum", {
//       body: data.body,
//       icon: "/icon",
//       badge: "/icon",
//       data: { url: data.url ?? "/" },
//     })
//   )
// })
//
// self.addEventListener("notificationclick", (event) => {
//   event.notification.close()
//   const url = event.notification.data?.url ?? "/"
//   event.waitUntil(self.clients.openWindow(url))
// })
