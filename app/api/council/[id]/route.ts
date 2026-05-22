import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { LabelMapping, Provider, SynthesisJson } from "@/lib/council/types"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid query id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: queryRow, error: queryErr } = await supabase
    .from("council_queries")
    .select(
      "id, question, status, total_cost_usd, created_at, completed_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 })
  }
  if (!queryRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: voiceRows } = await supabase
    .from("voice_responses")
    .select(
      "provider, model, anonymous_label, ok, response_json, error, input_tokens, output_tokens, cost_usd, latency_ms",
    )
    .eq("query_id", id)

  const { data: synthRow } = await supabase
    .from("syntheses")
    .select(
      "synthesis_markdown, synthesis_json, recommendation, confidence, label_mapping, input_tokens, output_tokens, cost_usd, latency_ms",
    )
    .eq("query_id", id)
    .maybeSingle()

  return NextResponse.json({
    query: queryRow,
    voices: (voiceRows ?? []).map((v) => ({
      provider: v.provider as Provider,
      model: v.model as string,
      anonymous_label: v.anonymous_label as "A" | "B" | "C",
      ok: v.ok as boolean,
      response_json: v.response_json,
      error: v.error as string | null,
      input_tokens: v.input_tokens as number | null,
      output_tokens: v.output_tokens as number | null,
      cost_usd: v.cost_usd as number | null,
      latency_ms: v.latency_ms as number | null,
    })),
    synthesis: synthRow
      ? {
          markdown: synthRow.synthesis_markdown as string,
          json: synthRow.synthesis_json as SynthesisJson,
          recommendation: synthRow.recommendation as string | null,
          confidence: synthRow.confidence as "high" | "medium" | "low" | null,
          label_mapping: synthRow.label_mapping as LabelMapping,
          input_tokens: synthRow.input_tokens as number | null,
          output_tokens: synthRow.output_tokens as number | null,
          cost_usd: synthRow.cost_usd as number | null,
          latency_ms: synthRow.latency_ms as number | null,
        }
      : null,
  })
}
