import type { SupabaseClient } from "@supabase/supabase-js"
import { runCouncil } from "@/lib/council/orchestrator"
import { interpret } from "./cron"
import type { ScheduledTask } from "./types"

/**
 * Execute a single scheduled task end-to-end:
 *   1. Insert a pending scheduled_task_runs row.
 *   2. Invoke the council orchestrator with the task's prompt.
 *   3. Update the run row with the resulting council_query_id and status.
 *   4. Compute next_run_at from the cron expression and update the task.
 *
 * Uses the admin Supabase client so RLS doesn't block the cron path —
 * authorship is attributed to the task's user_id explicitly.
 */
export async function runScheduledTask(
  admin: SupabaseClient,
  task: ScheduledTask,
): Promise<{ ok: boolean; council_query_id?: string; error?: string }> {
  // 1. open a pending run row so failures are visible in history
  const { data: runRow, error: runErr } = await admin
    .from("scheduled_task_runs")
    .insert({
      task_id: task.id,
      status: "pending",
    })
    .select("id")
    .single()

  if (runErr || !runRow) {
    return { ok: false, error: `Failed to create run row: ${runErr?.message}` }
  }

  const run_id = runRow.id as string

  try {
    // 2. run the council orchestrator using the admin client so RLS
    //    doesn't block (council_queries rows still carry the task's
    //    user_id for ownership)
    const result = await runCouncil({
      supabase: admin,
      userId: task.user_id,
      question: task.prompt,
      context: [], // scheduled tasks intentionally have no session context
    })

    // 3a. mark the run row completed
    await admin
      .from("scheduled_task_runs")
      .update({
        status: "completed",
        council_query_id: result.query_id,
      })
      .eq("id", run_id)

    // 4. compute next run time
    await advanceTaskSchedule(admin, task)

    return { ok: true, council_query_id: result.query_id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // 3b. mark the run row failed
    await admin
      .from("scheduled_task_runs")
      .update({
        status: "failed",
        error: message.slice(0, 2000),
      })
      .eq("id", run_id)

    // Still advance the schedule so we don't get stuck in a tight retry loop
    await advanceTaskSchedule(admin, task)

    return { ok: false, error: message }
  }
}

/**
 * Update next_run_at + last_run_at on the task using its cron + timezone.
 * Called after every run, success or failure.
 */
async function advanceTaskSchedule(
  admin: SupabaseClient,
  task: ScheduledTask,
): Promise<void> {
  const now = new Date()
  const interp = interpret(task.schedule_cron, task.timezone, now)

  await admin
    .from("scheduled_tasks")
    .update({
      last_run_at: now.toISOString(),
      next_run_at: interp.next?.toISOString() ?? null,
    })
    .eq("id", task.id)
}

/**
 * Recompute next_run_at for a task without running it. Used when a
 * task is created or its schedule is edited.
 */
export async function computeNextRunAt(
  task: Pick<ScheduledTask, "schedule_cron" | "timezone">,
  from: Date = new Date(),
): Promise<Date | null> {
  const interp = interpret(task.schedule_cron, task.timezone, from)
  return interp.next ?? null
}
