import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface IncomingSubscription {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

// GET — list current user's subscriptions (for settings page status)
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, user_agent, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Endpoint is long + sensitive-ish; only return enough to identify the device
  const subscriptions = (data ?? []).map((s) => ({
    id: s.id as string,
    endpoint_origin: extractOrigin(s.endpoint as string),
    user_agent: s.user_agent as string | null,
    created_at: s.created_at as string,
    last_used_at: s.last_used_at as string,
  }))

  return NextResponse.json({ subscriptions })
}

// POST — register or refresh a subscription
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: IncomingSubscription
  try {
    body = (await request.json()) as IncomingSubscription
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : ""
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : ""
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh, and keys.auth are required" },
      { status: 400 },
    )
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null

  // Upsert: same (user_id, endpoint) → refresh keys + user_agent
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

// DELETE — remove a subscription by id (from settings page) or by endpoint
// (when the client knows the endpoint but not the id)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { id?: string; endpoint?: string } = {}
  try {
    body = (await request.json()) as { id?: string; endpoint?: string }
  } catch {
    // body optional for some clients — fall through with empty body
  }

  const id = typeof body.id === "string" ? body.id : null
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null

  if (!id && !endpoint) {
    return NextResponse.json(
      { error: "id or endpoint is required" },
      { status: 400 },
    )
  }

  let query = supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)

  if (id) query = query.eq("id", id)
  else if (endpoint) query = query.eq("endpoint", endpoint)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function extractOrigin(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    return url.hostname
  } catch {
    return "unknown"
  }
}
