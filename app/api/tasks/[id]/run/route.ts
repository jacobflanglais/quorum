import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runScheduledTask } from "@/lib/scheduler/runner"
import type { ScheduledTask } from "@/lib/scheduler/types"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const UUID_RE = /^[0-9a-f-]{36}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Manual trigger — runs a scheduled task on demand without waiting
 * for its cron to fire. Useful for testing and "run this now" UX.
 *
 * Still goes through the runner so the run is logged and the schedule
 * advances naturally.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
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

  // Verify the task belongs to the caller, then hand off to the
  // admin client (the runner needs RLS bypass to write the run row
  // attributed to the cron path).
  const { data: task } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const admin = createAdminClient()
  const result = await runScheduledTask(admin, task as ScheduledTask)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    council_query_id: result.council_query_id,
  })
}
