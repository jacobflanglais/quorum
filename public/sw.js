// Quorum Service Worker
//
// Phase 2: minimal registration + network-first passthrough.
// Phase 4b: push + notificationclick handlers active for scheduled
// task completion notifications.

const VERSION = "quorum-sw-v2"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  // Network-only passthrough. Quorum is a network-required app —
  // every query hits the API. Cache strategy lands once the app
  // stabilizes.
})

// ── Push notifications ──────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Quorum", body: event.data.text() }
  }

  const title = payload.title || "Quorum"
  const options = {
    body: payload.body || "",
    icon: "/icon",
    badge: "/icon",
    data: { url: payload.url || "/" },
    tag: payload.tag, // re-uses notification if same tag (no spam)
    renotify: false, // silent if updating an existing tag
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.url || "/"

  // Focus an existing window if one is open, else open a new one.
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        // Same origin window already open — focus + navigate
        try {
          const url = new URL(client.url)
          if (url.origin === self.location.origin) {
            await client.focus()
            await client.navigate(target)
            return
          }
        } catch {
          // continue
        }
      }
      // No matching window — open one
      await self.clients.openWindow(target)
    })(),
  )
})
