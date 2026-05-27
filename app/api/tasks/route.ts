import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeNextRunAt } from "@/lib/scheduler/runner"
import { interpret } from "@/lib/scheduler/cron"
import type { ScheduledTask } from "@/lib/scheduler/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: (data ?? []) as ScheduledTask[] })
}

export async function POST(request: NextRequest) {
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
  if (!isObject(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 })
  }

  const name = stringField(body.name)
  const prompt = stringField(body.prompt)
  const schedule_cron = stringField(body.schedule_cron)
  const timezone = stringField(body.timezone) || "UTC"
  const description = stringField(body.description) || null
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 16)
    : []
  const enabled = body.enabled !== false
  const search_enabled = body.search_enabled === true
  const deep_research_enabled = body.deep_research_enabled === true
  const notify_email = body.notify_email !== false
  const notify_push = body.notify_push !== false

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }
  if (!schedule_cron) {
    return NextResponse.json(
      { error: "schedule_cron is required" },
      { status: 400 },
    )
  }

  const interp = interpret(schedule_cron, timezone)
  if (!interp.valid) {
    return NextResponse.json(
      { error: `Invalid cron: ${interp.error}` },
      { status: 400 },
    )
  }

  const next_run_at = (await computeNextRunAt({ schedule_cron, timezone }))?.toISOString() ?? null

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .insert({
      user_id: user.id,
      name,
      description,
      prompt,
      schedule_cron,
      timezone,
      tags,
      enabled,
      search_enabled,
      deep_research_enabled,
      notify_email,
      notify_push,
      next_run_at,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data as ScheduledTask })
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function stringField(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}
