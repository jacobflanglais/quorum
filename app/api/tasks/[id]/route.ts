import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeNextRunAt } from "@/lib/scheduler/runner"
import { interpret } from "@/lib/scheduler/cron"
import type {
  ScheduledTask,
  ScheduledTaskRunDetail,
} from "@/lib/scheduler/types"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f-]{36}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

// ── GET: task + its run history ─────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: task, error: taskErr } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 })
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: runRows } = await supabase
    .from("scheduled_task_runs")
    .select(
      `
      id, task_id, council_query_id, status, ran_at, error,
      council_queries ( question, syntheses ( recommendation, confidence ) )
    `,
    )
    .eq("task_id", id)
    .order("ran_at", { ascending: false })
    .limit(50)

  const runs: ScheduledTaskRunDetail[] = (runRows ?? []).map((row) => {
    const cq = Array.isArray(row.council_queries)
      ? row.council_queries[0]
      : row.council_queries
    const synth = cq
      ? Array.isArray(cq.syntheses)
        ? cq.syntheses[0]
        : cq.syntheses
      : null
    return {
      id: row.id as string,
      task_id: row.task_id as string,
      council_query_id: row.council_query_id as string | null,
      status: row.status as "pending" | "completed" | "failed",
      ran_at: row.ran_at as string,
      error: row.error as string | null,
      question: (cq?.question as string | undefined) ?? null,
      recommendation: (synth?.recommendation as string | undefined) ?? null,
      confidence: (synth?.confidence as "high" | "medium" | "low" | undefined) ?? null,
    }
  })

  return NextResponse.json({ task: task as ScheduledTask, runs })
}

// ── PATCH: update task fields ──────────────────────────────

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
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
  if (!isObject(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim()
  if (typeof body.description === "string" || body.description === null) {
    updates.description = typeof body.description === "string" ? body.description : null
  }
  if (typeof body.prompt === "string" && body.prompt.trim()) updates.prompt = body.prompt.trim()
  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.filter((t): t is string => typeof t === "string").slice(0, 16)
  }
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled
  if (typeof body.search_enabled === "boolean") updates.search_enabled = body.search_enabled
  if (typeof body.notify_email === "boolean") updates.notify_email = body.notify_email
  if (typeof body.notify_push === "boolean") updates.notify_push = body.notify_push

  let scheduleChanged = false
  if (typeof body.schedule_cron === "string" && body.schedule_cron.trim()) {
    updates.schedule_cron = body.schedule_cron.trim()
    scheduleChanged = true
  }
  if (typeof body.timezone === "string" && body.timezone.trim()) {
    updates.timezone = body.timezone.trim()
    scheduleChanged = true
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 })
  }

  if (scheduleChanged) {
    const sched = (updates.schedule_cron as string) ?? undefined
    const tz = (updates.timezone as string) ?? undefined
    // Need both fields to validate — fetch current values to fill gaps
    const { data: existing } = await supabase
      .from("scheduled_tasks")
      .select("schedule_cron, timezone")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const finalCron = sched ?? (existing.schedule_cron as string)
    const finalTz = tz ?? (existing.timezone as string)
    const interp = interpret(finalCron, finalTz)
    if (!interp.valid) {
      return NextResponse.json(
        { error: `Invalid cron: ${interp.error}` },
        { status: 400 },
      )
    }
    const next = await computeNextRunAt({
      schedule_cron: finalCron,
      timezone: finalTz,
    })
    updates.next_run_at = next?.toISOString() ?? null
  }

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data as ScheduledTask })
}

// ── DELETE: remove task (runs cascade via FK) ──────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { error } = await supabase
    .from("scheduled_tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}
