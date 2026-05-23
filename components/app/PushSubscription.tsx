"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, Check, Loader2, X } from "lucide-react"

interface DeviceSubscription {
  id: string
  endpoint_origin: string
  user_agent: string | null
  created_at: string
  last_used_at: string
}

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "default" // never asked
  | "subscribed"
  | "subscribing"
  | "unsubscribing"
  | "error"

export function PushSubscription() {
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceSubscription[]>([])
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)

  // Read devices from server (other browsers/PWAs)
  const refreshDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/push/subscribe", { cache: "no-store" })
      if (res.ok) {
        const data = (await res.json()) as { subscriptions: DeviceSubscription[] }
        setDevices(data.subscriptions ?? [])
      }
    } catch {
      // non-fatal
    }
  }, [])

  // Initial: check browser capability + current subscription state
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (typeof window === "undefined") return
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported")
        return
      }

      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return

        if (sub) {
          setCurrentEndpoint(sub.endpoint)
          setStatus("subscribed")
        } else {
          // Permission may be granted but no active subscription
          // (e.g. user revoked at OS level or fresh install).
          const perm =
            typeof Notification !== "undefined"
              ? Notification.permission
              : "denied"
          setStatus(perm === "denied" ? "denied" : "default")
        }
        await refreshDevices()
      } catch (err) {
        if (cancelled) return
        setStatus("error")
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshDevices])

  async function subscribe() {
    setError(null)
    setStatus("subscribing")
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error("VAPID public key is not configured")

      // Request permission first if needed
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission()
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "default")
          return
        }
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      // Send to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      setCurrentEndpoint(sub.endpoint)
      setStatus("subscribed")
      await refreshDevices()
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Subscribe failed")
    }
  }

  async function unsubscribeThisDevice() {
    setError(null)
    setStatus("unsubscribing")
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
      }
      setCurrentEndpoint(null)
      setStatus("default")
      await refreshDevices()
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unsubscribe failed")
    }
  }

  async function removeDevice(id: string, endpoint_origin: string) {
    if (!confirm(`Remove the device at ${endpoint_origin}?`)) return
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      await refreshDevices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed")
    }
  }

  return (
    <div>
      <StatusCard
        status={status}
        error={error}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribeThisDevice}
      />

      {devices.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Registered devices
          </p>
          <ul className="flex flex-col gap-2">
            {devices.map((d) => {
              const isCurrent =
                currentEndpoint?.includes(d.endpoint_origin) ?? false
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {summarizeUserAgent(d.user_agent)}
                      {isCurrent && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                          · This device
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                      {d.endpoint_origin} ·{" "}
                      {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDevice(d.id, d.endpoint_origin)}
                    aria-label="Remove device"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:border-critical/40 hover:text-critical"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatusCard({
  status,
  error,
  onSubscribe,
  onUnsubscribe,
}: {
  status: Status
  error: string | null
  onSubscribe: () => void
  onUnsubscribe: () => void
}) {
  if (status === "unsupported") {
    return (
      <Card>
        <Icon>
          <BellOff className="h-5 w-5 text-fg-ghost" />
        </Icon>
        <div className="flex-1">
          <p className="text-sm text-foreground">Not supported in this browser</p>
          <p className="mt-1 text-xs text-fg-muted">
            Web Push works in Chrome, Edge, Firefox, and Safari 16.4+ (iOS
            requires installing Quorum to the home screen first).
          </p>
        </div>
      </Card>
    )
  }
  if (status === "denied") {
    return (
      <Card>
        <Icon>
          <BellOff className="h-5 w-5 text-critical" />
        </Icon>
        <div className="flex-1">
          <p className="text-sm text-foreground">Notifications blocked</p>
          <p className="mt-1 text-xs text-fg-muted">
            You denied notification permission. Re-enable in your browser
            site settings, then reload this page.
          </p>
        </div>
      </Card>
    )
  }
  if (status === "loading") {
    return (
      <Card>
        <Icon>
          <Loader2 className="h-5 w-5 animate-spin text-fg-ghost" />
        </Icon>
        <div className="flex-1 text-sm text-fg-muted">Checking notification status…</div>
      </Card>
    )
  }
  if (status === "subscribed") {
    return (
      <Card highlighted>
        <Icon>
          <Check className="h-5 w-5 text-success" />
        </Icon>
        <div className="flex-1">
          <p className="text-sm text-foreground">Push notifications on</p>
          <p className="mt-1 text-xs text-fg-muted">
            Scheduled task results will land on this device&rsquo;s lock screen.
          </p>
        </div>
        <Button onClick={onUnsubscribe} variant="ghost">
          Disable
        </Button>
      </Card>
    )
  }
  if (status === "subscribing") {
    return (
      <Card>
        <Icon>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </Icon>
        <div className="flex-1 text-sm text-foreground">Subscribing…</div>
      </Card>
    )
  }
  if (status === "unsubscribing") {
    return (
      <Card>
        <Icon>
          <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
        </Icon>
        <div className="flex-1 text-sm text-foreground">Unsubscribing…</div>
      </Card>
    )
  }
  if (status === "error") {
    return (
      <Card>
        <Icon>
          <BellOff className="h-5 w-5 text-critical" />
        </Icon>
        <div className="flex-1">
          <p className="text-sm text-foreground">Could not enable push</p>
          <p className="mt-1 text-xs leading-relaxed text-critical">
            {error ?? "Unknown error"}
          </p>
        </div>
        <Button onClick={onSubscribe}>Retry</Button>
      </Card>
    )
  }
  // status === "default"
  return (
    <Card>
      <Icon>
        <Bell className="h-5 w-5 text-fg-muted" />
      </Icon>
      <div className="flex-1">
        <p className="text-sm text-foreground">Push notifications off</p>
        <p className="mt-1 text-xs text-fg-muted">
          Enable to receive scheduled task results as lock-screen notifications
          on this device.
        </p>
      </div>
      <Button onClick={onSubscribe}>Enable</Button>
    </Card>
  )
}

function Card({
  children,
  highlighted = false,
}: {
  children: React.ReactNode
  highlighted?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-5 ${
        highlighted
          ? "border-accent-muted/30 bg-accent-subtle"
          : "border-border bg-surface"
      }`}
    >
      {children}
    </div>
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return <div className="shrink-0 pt-0.5">{children}</div>
}

function Button({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: "primary" | "ghost"
}) {
  const styles =
    variant === "ghost"
      ? "border-border text-fg-muted hover:text-foreground"
      : "border-accent-muted/50 bg-accent-subtle text-primary hover:bg-accent-muted/20"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border ${styles} px-4 font-mono text-[10px] uppercase tracking-widest transition-colors`}
    >
      {children}
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  // Allocate an explicit ArrayBuffer (not the default ArrayBufferLike) so
  // the resulting Uint8Array satisfies PushSubscriptionOptionsInit's
  // BufferSource type under TS 5.7+'s stricter generic Uint8Array.
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device"
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone / iPad"
  if (/Android/.test(ua)) return "Android"
  if (/Macintosh/.test(ua)) {
    if (/Chrome/.test(ua)) return "Mac · Chrome"
    if (/Safari/.test(ua)) return "Mac · Safari"
    return "Mac"
  }
  if (/Windows/.test(ua)) return "Windows"
  if (/Linux/.test(ua)) return "Linux"
  return ua.slice(0, 60)
}
