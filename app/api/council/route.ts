import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runCouncil } from "@/lib/council/orchestrator"
import type { SessionContextEntry } from "@/lib/council/types"

const SESSION_CONTEXT_LIMIT = 3

// Rough pre-call cost ceiling. Real cost is recorded post-call.
const MAX_QUESTION_CHARS = 8_000

export const dynamic = "force-dynamic"
export const maxDuration = 120 // seconds

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

  const question = isObject(body) && typeof body.question === "string"
    ? body.question.trim()
    : ""
  const searchEnabled =
    isObject(body) && typeof body.searchEnabled === "boolean"
      ? body.searchEnabled
      : false
  const deepResearch =
    isObject(body) && typeof body.deepResearch === "boolean"
      ? body.deepResearch
      : false

  if (question.length === 0) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 })
  }

  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      {
        error: `Question is too long (max ${MAX_QUESTION_CHARS} chars).`,
      },
      { status: 400 },
    )
  }

  // Load session context: last N completed queries' recommendations
  const context = await loadSessionContext(supabase, user.id)

  try {
    const result = await runCouncil({
      supabase,
      userId: user.id,
      question,
      context,
      searchEnabled,
      deepResearch,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("Council orchestrator failed:", err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Council orchestration failed unexpectedly.",
      },
      { status: 500 },
    )
  }
}

async function loadSessionContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<SessionContextEntry[]> {
  const { data, error } = await supabase
    .from("council_queries")
    .select(
      `
      question,
      syntheses ( recommendation )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(SESSION_CONTEXT_LIMIT)

  if (error || !data) return []

  return data
    .map((row) => {
      const synthesis = Array.isArray(row.syntheses)
        ? row.syntheses[0]
        : row.syntheses
      const recommendation = synthesis?.recommendation as string | undefined
      if (!recommendation) return null
      return {
        question: row.question as string,
        recommendation,
      }
    })
    .filter((entry): entry is SessionContextEntry => entry !== null)
    .reverse() // chronological order for the prompt
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}
