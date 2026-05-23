"use client"

import { useEffect } from "react"

/**
 * Registers the service worker on first client mount.
 *
 * - Only runs in the browser.
 * - Only runs in production builds — dev builds skip registration
 *   so HMR isn't interfered with by an active SW.
 * - Silently no-ops if the browser doesn't support service workers.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      } catch {
        // Non-fatal — if registration fails, the app still works
        // as a normal web app. PWA install + push become unavailable.
      }
    }

    register()
  }, [])

  return null
}
