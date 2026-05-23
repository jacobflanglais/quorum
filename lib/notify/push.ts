import webpush, { type PushSubscription as WebPushSubscription } from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Web Push fan-out.
 *
 * VAPID setup once at module load. Sends are best-effort: a failed
 * subscription (browser uninstalled the PWA, user revoked permission)
 * gets pruned from the DB so the next round is clean.
 */

let configured = false

function configureWebPush() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT // e.g. "mailto:you@example.com"

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID config missing: need NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT",
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Send a payload to every push subscription for a user.
 * Returns counts so callers can log success/failure.
 * Stale subscriptions (HTTP 404/410) are pruned automatically.
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; failed: number }> {
  configureWebPush()

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (error || !subs || subs.length === 0) {
    return { sent: 0, pruned: 0, failed: 0 }
  }

  let sent = 0
  let pruned = 0
  let failed = 0
  const payloadJson = JSON.stringify(payload)

  await Promise.all(
    (subs as StoredSubscription[]).map(async (s) => {
      const sub: WebPushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }

      try {
        await webpush.sendNotification(sub, payloadJson)
        sent++
        // touch last_used_at so we can identify zombie subs later
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id)
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead — browser uninstalled / permission revoked.
          // Prune so we don't keep trying.
          await admin.from("push_subscriptions").delete().eq("id", s.id)
          pruned++
        } else {
          console.error(
            `[push] send failed for sub ${s.id}:`,
            err instanceof Error ? err.message : err,
          )
          failed++
        }
      }
    }),
  )

  return { sent, pruned, failed }
}
