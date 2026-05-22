import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PROVIDERS, type Provider } from "@/lib/council/types"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ provider: string }>
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { provider } = await ctx.params

  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const patch = isObject(body) ? body : {}
  const updates: Record<string, string> = {}

  if (typeof patch.current_model === "string" && patch.current_model.trim()) {
    updates.current_model = patch.current_model.trim()
  }
  if (
    typeof patch.fallback_model === "string" ||
    patch.fallback_model === null
  ) {
    updates.fallback_model =
      typeof patch.fallback_model === "string"
        ? patch.fallback_model.trim()
        : ""
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields in body" },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("model_registry")
    .update(updates)
    .eq("provider", provider)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, provider, updates })
}

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}
