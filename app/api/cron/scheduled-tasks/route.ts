import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runScheduledTask } from "@/lib/scheduler/runner"
import type { ScheduledTask } from "@/lib/scheduler/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — three council calls per task can stack

const MAX_TASKS_PER_TICK = 5

/**
 * Vercel Cron endpoint. Fires every 5 minutes.
 *
 * Strategy:
 *   1. Verify the Bearer token matches CRON_SECRET (Vercel sets this
 *      via the dashboard; the cron runner sends it automatically).
 *   2. Find all enabled tasks with next_run_at <= now.
 *   3. Run up to MAX_TASKS_PER_TICK of them sequentially. (Parallel
 *      would explode provider costs and risk rate limits.)
 *   4. The runner advances next_run_at automatically; any tasks not
 *      picked up this tick get picked up next tick.
 *
 * No retries beyond the schedule's natural cadence — if a task fails,
 * the failure is logged in scheduled_task_runs and the next scheduled
 * occurrence runs normally.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: dueRows, error } = await admin
    .from("scheduled_tasks")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(MAX_TASKS_PER_TICK)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tasks = (dueRows ?? []) as ScheduledTask[]
  const results: Array<{
    task_id: string
    name: string
    ok: boolean
    council_query_id?: string
    error?: string
  }> = []

  for (const task of tasks) {
    const result = await runScheduledTask(admin, task)
    results.push({
      task_id: task.id,
      name: task.name,
      ok: result.ok,
      council_query_id: result.council_query_id,
      error: result.error,
    })
  }

  return NextResponse.json({
    tick_at: nowIso,
    considered: tasks.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
