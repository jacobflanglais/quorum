import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const HISTORY_LIMIT = 50

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("council_queries")
    .select(
      `
      id,
      question,
      status,
      total_cost_usd,
      created_at,
      completed_at,
      syntheses ( recommendation, confidence )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []).map((row) => {
    const synthesis = Array.isArray(row.syntheses)
      ? row.syntheses[0]
      : row.syntheses
    return {
      id: row.id as string,
      question: row.question as string,
      status: row.status as "pending" | "completed" | "failed",
      total_cost_usd: row.total_cost_usd as number | null,
      created_at: row.created_at as string,
      completed_at: row.completed_at as string | null,
      recommendation: (synthesis?.recommendation ?? null) as string | null,
      confidence: (synthesis?.confidence ?? null) as
        | "high"
        | "medium"
        | "low"
        | null,
    }
  })

  return NextResponse.json({ items })
}
