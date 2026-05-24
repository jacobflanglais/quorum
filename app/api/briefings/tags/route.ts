import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/briefings/tags
 *
 * Returns distinct tags across the user's scheduled_tasks, sorted by
 * frequency desc then alpha. Used to populate the filter chip cloud
 * on /briefings and the autocomplete inside TagInput.
 */
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
    .select("tags")
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const tags = (row.tags as string[]) ?? []
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const tags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({ tags })
}
