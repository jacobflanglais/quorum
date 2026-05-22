import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { writeAppConfig } from "@/lib/council/config"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
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
  const model =
    typeof patch.synthesizer_model === "string"
      ? patch.synthesizer_model.trim()
      : ""

  if (!model) {
    return NextResponse.json(
      { error: "synthesizer_model is required" },
      { status: 400 },
    )
  }

  try {
    const updated = await writeAppConfig({ synthesizer_model: model })
    return NextResponse.json({ ok: true, appConfig: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    )
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}
