import type { SupabaseClient } from "@supabase/supabase-js"
import { buildVoiceMessages } from "./prompts"
import { readAppConfig } from "./config"
import { findProviderModel, readRegistry } from "./registry"
import { VOICE_CALLERS } from "./voices"
import { anonymize } from "./anonymizer"
import { synthesize } from "./synthesizer"
import { PROVIDERS } from "./types"
import { tavilySearch, type SearchResult } from "@/lib/search/tavily"
import type {
  AnonymizedVoice,
  CouncilResult,
  LabelMapping,
  Provider,
  SessionContextEntry,
  SynthesisResult,
  VoiceResult,
} from "./types"

export interface RunCouncilArgs {
  supabase: SupabaseClient
  userId: string
  question: string
  context?: SessionContextEntry[]
  /** If true, run a Tavily search and pass results to voices + synthesizer. */
  searchEnabled?: boolean
}

/**
 * Orchestrate one council query:
 *
 *   1. Create a pending council_queries row.
 *   2. Read model_registry → current model per provider.
 *   3. Fan out the same voice prompt to all 3 providers in parallel
 *      (Promise.allSettled, 60s per-provider timeout inside each client).
 *   4. Persist every voice_responses row (success or failure) immediately.
 *   5. If ≥ 2 voices succeeded, anonymize and call the synthesizer.
 *   6. Persist the synthesis row.
 *   7. Mark the council_queries row completed (or failed if < 2 voices).
 *
 * Writes go through the supplied (server) Supabase client so RLS
 * enforces user ownership on every row.
 */
export async function runCouncil({
  supabase,
  userId,
  question,
  context = [],
  searchEnabled = false,
}: RunCouncilArgs): Promise<CouncilResult> {
  const start = Date.now()

  // 1. create the council_queries row up front
  const contextIds = context.length > 0 ? context.map((_, i) => i) : null
  // Note: contextIds is just a placeholder index list; in Phase 1d we'll
  // pass real query IDs in. For now context is empty.
  void contextIds // silence unused for now

  const { data: queryRow, error: queryErr } = await supabase
    .from("council_queries")
    .insert({
      user_id: userId,
      question,
      status: "pending",
    })
    .select("id")
    .single()

  if (queryErr || !queryRow) {
    throw new Error(
      `Failed to create council_queries row: ${queryErr?.message ?? "no row returned"}`,
    )
  }

  const query_id = queryRow.id as string

  try {
    // 2. read the model registry
    const registry = await readRegistry()
    const providerModels = Object.fromEntries(
      PROVIDERS.map((p) => [p, findProviderModel(registry, p).model]),
    ) as Record<Provider, string>

    // 2b. (Phase 6) if search enabled, fetch web sources before fan-out.
    //     Failures are non-fatal — we proceed without grounding rather
    //     than failing the whole query.
    let searchResults: SearchResult[] = []
    let searchCost = 0
    if (searchEnabled) {
      try {
        const tavily = await tavilySearch({ query: question })
        searchResults = tavily.results
        searchCost = tavily.cost_usd
        await supabase
          .from("council_queries")
          .update({ search_results: tavily.results as unknown })
          .eq("id", query_id)
      } catch (err) {
        console.error(
          "[council] tavily search failed (continuing without grounding):",
          err instanceof Error ? err.message : err,
        )
      }
    }

    // 3. fan out
    const { system, user } = buildVoiceMessages({
      question,
      context,
      sources: searchResults.length > 0 ? searchResults : undefined,
    })

    const voicePromises = PROVIDERS.map(async (provider) =>
      VOICE_CALLERS[provider]({
        model: providerModels[provider],
        system,
        user,
      }),
    )

    const settled = await Promise.allSettled(voicePromises)

    const voices: VoiceResult[] = settled.map((result, idx) => {
      const provider = PROVIDERS[idx]!
      if (result.status === "fulfilled") return result.value
      return {
        ok: false,
        provider,
        model: providerModels[provider],
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        latency_ms: 0,
      }
    })

    // 4. persist voice_responses (all rows, success and failure)
    const successful = voices.filter(
      (v): v is Extract<VoiceResult, { ok: true }> => v.ok,
    )

    // Anonymization labels are assigned to SUCCESSFUL voices only.
    // For failed voices we still write a row but with no label.
    let anonymizedVoices: AnonymizedVoice[] = []
    let labelMapping: LabelMapping = {} as LabelMapping
    if (successful.length > 0) {
      const result = anonymize(successful)
      anonymizedVoices = result.anonymized
      labelMapping = result.mapping
    }

    const inverseMapping = invertMapping(labelMapping)

    const voiceRows = voices.map((v) => {
      const labelForProvider = inverseMapping[v.provider]
      if (v.ok) {
        return {
          query_id,
          provider: v.provider,
          model: v.model,
          anonymous_label: labelForProvider ?? "A",
          ok: true,
          response_json: v.response as unknown,
          raw_response: v.raw_response,
          error: null,
          input_tokens: v.input_tokens,
          output_tokens: v.output_tokens,
          cost_usd: v.cost_usd,
          latency_ms: v.latency_ms,
        }
      }
      return {
        query_id,
        provider: v.provider,
        model: v.model,
        anonymous_label: "A", // failed voices get a placeholder; ignore in UI
        ok: false,
        response_json: null,
        raw_response: null,
        error: v.error,
        input_tokens: null,
        output_tokens: null,
        cost_usd: null,
        latency_ms: v.latency_ms,
      }
    })

    const { error: voiceInsertErr } = await supabase
      .from("voice_responses")
      .insert(voiceRows)

    if (voiceInsertErr) {
      throw new Error(
        `Failed to insert voice_responses: ${voiceInsertErr.message}`,
      )
    }

    // 5–6. synthesize if we have ≥ 2 successful voices
    //
    // Synthesizer is intentionally a DIFFERENT model than any voice —
    // putting the judge outside the voice pool structurally eliminates
    // self-bias (anonymization remains as defense in depth). Default:
    // Sonnet 4.6 for synthesis, Opus 4.7 for the Anthropic voice. The
    // user can change this on the /settings page (app_config table).
    let synthesis: SynthesisResult | null = null
    if (successful.length >= 2) {
      const appConfig = await readAppConfig()
      const synthesizerModel =
        process.env.QUORUM_SYNTHESIZER_MODEL ?? appConfig.synthesizer_model
      synthesis = await synthesize({
        model: synthesizerModel,
        question,
        context,
        anonymizedVoices,
        sources: searchResults.length > 0 ? searchResults : undefined,
      })

      const { error: synthErr } = await supabase.from("syntheses").insert({
        query_id,
        synthesis_markdown: synthesis.markdown,
        synthesis_json: synthesis.json as unknown,
        recommendation: synthesis.json.recommendation.text,
        confidence: synthesis.json.recommendation.confidence,
        label_mapping: labelMapping as unknown,
        input_tokens: synthesis.input_tokens,
        output_tokens: synthesis.output_tokens,
        cost_usd: synthesis.cost_usd,
        latency_ms: synthesis.latency_ms,
      })

      if (synthErr) {
        throw new Error(`Failed to insert syntheses: ${synthErr.message}`)
      }
    }

    // 7. mark complete
    const total_cost_usd =
      voices.reduce((sum, v) => sum + (v.ok ? v.cost_usd : 0), 0) +
      (synthesis?.cost_usd ?? 0) +
      searchCost

    const total_latency_ms = Date.now() - start

    const finalStatus = synthesis ? "completed" : "failed"
    await supabase
      .from("council_queries")
      .update({
        status: finalStatus,
        total_cost_usd,
        completed_at: new Date().toISOString(),
      })
      .eq("id", query_id)

    return {
      query_id,
      question,
      voices,
      label_mapping: labelMapping,
      synthesis,
      search_results: searchResults.length > 0 ? searchResults : null,
      total_cost_usd,
      total_latency_ms,
    }
  } catch (err) {
    // mark the query as failed on any unexpected error
    await supabase
      .from("council_queries")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", query_id)

    throw err
  }
}

function invertMapping(
  mapping: LabelMapping,
): Partial<Record<Provider, "A" | "B" | "C">> {
  const inverse: Partial<Record<Provider, "A" | "B" | "C">> = {}
  for (const [label, provider] of Object.entries(mapping)) {
    inverse[provider] = label as "A" | "B" | "C"
  }
  return inverse
}
