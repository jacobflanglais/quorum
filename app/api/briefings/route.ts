import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const RESULT_LIMIT = 200

export interface BriefingItem {
  run_id: string
  task_id: string
  task_name: string
  tags: string[]
  council_query_id: string | null
  ran_at: string
  status: "pending" | "completed" | "failed"
  question: string | null
  recommendation: string | null
  confidence: "high" | "medium" | "low" | null
  total_cost_usd: number | null
}

/**
 * GET /api/briefings?tag=foo&tag=bar&q=keyword&since=YYYY-MM-DD
 *
 * Returns recent scheduled-task RUNS (not the tasks themselves) joined
 * with the task name + tags and the resulting council_queries + synthesis
 * recommendation. Used by the /briefings page to browse the archive.
 *
 * Filters are AND-composed:
 *   - tag=foo&tag=bar  → tasks whose tags array contains BOTH foo AND bar
 *   - q=keyword        → question OR recommendation ILIKE %keyword%
 *   - since=date       → ran_at >= date (ISO format)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const tags = url.searchParams.getAll("tag").filter(Boolean)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const since = url.searchParams.get("since")

  // Pull runs joined to tasks + council_queries + syntheses.
  // We filter by user_id at the run level via the task FK.
  let query = supabase
    .from("scheduled_task_runs")
    .select(
      `
      id,
      task_id,
      status,
      ran_at,
      council_query_id,
      scheduled_tasks!inner ( name, tags, user_id ),
      council_queries ( question, total_cost_usd, syntheses ( recommendation, confidence ) )
    `,
    )
    .eq("scheduled_tasks.user_id", user.id)
    .order("ran_at", { ascending: false })
    .limit(RESULT_LIMIT)

  if (tags.length > 0) {
    // .contains expects the column to be a superset of the given array
    query = query.contains("scheduled_tasks.tags", tags)
  }

  if (since) {
    query = query.gte("ran_at", since)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let items: BriefingItem[] = (data ?? []).map((row) => {
    const task = Array.isArray(row.scheduled_tasks)
      ? row.scheduled_tasks[0]
      : row.scheduled_tasks
    const cq = Array.isArray(row.council_queries)
      ? row.council_queries[0]
      : row.council_queries
    const synth = cq
      ? Array.isArray(cq.syntheses)
        ? cq.syntheses[0]
        : cq.syntheses
      : null

    return {
      run_id: row.id as string,
      task_id: row.task_id as string,
      task_name: (task?.name as string) ?? "",
      tags: ((task?.tags as string[]) ?? []),
      council_query_id: row.council_query_id as string | null,
      ran_at: row.ran_at as string,
      status: row.status as "pending" | "completed" | "failed",
      question: (cq?.question as string | undefined) ?? null,
      recommendation: (synth?.recommendation as string | undefined) ?? null,
      confidence:
        (synth?.confidence as "high" | "medium" | "low" | undefined) ?? null,
      total_cost_usd: (cq?.total_cost_usd as number | undefined) ?? null,
    }
  })

  // Keyword filter applied in-process (Postgres ILIKE through the joined
  // synthesis column gets awkward with PostgREST; runs/queries cap at
  // RESULT_LIMIT so this stays cheap).
  if (q) {
    const needle = q.toLowerCase()
    items = items.filter(
      (item) =>
        (item.question?.toLowerCase().includes(needle) ?? false) ||
        (item.recommendation?.toLowerCase().includes(needle) ?? false) ||
        item.task_name.toLowerCase().includes(needle),
    )
  }

  return NextResponse.json({ items, total: items.length })
}
