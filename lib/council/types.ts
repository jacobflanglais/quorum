/**
 * Council domain types.
 *
 * Used across the orchestrator, voice clients, anonymizer,
 * synthesizer, and the API route. Wire-format types (the JSON
 * shape voices and the synthesizer produce) are validated by
 * Zod schemas in ./schemas.ts; this file is the TS source of truth.
 */

export type Provider = "anthropic" | "openai" | "google"

export const PROVIDERS: readonly Provider[] = [
  "anthropic",
  "openai",
  "google",
] as const

export type AnonymousLabel = "A" | "B" | "C"

export type ConfidencePosture = "firm" | "hedged" | "uncertain"

export type ConsensusType = "strong" | "majority" | "surface"

export type DivergenceRootCause =
  | "factual"
  | "framing"
  | "assumption"
  | "confidence"
  | "genuine_uncertainty"

export type DivergenceWeight = "high" | "medium" | "low"

export type SynthesisConfidence = "high" | "medium" | "low"

// ── voice output (each model returns this JSON) ─────────────
export interface VoiceJson {
  answer: string
  key_reasoning: string
  confidence: number // 0..1
  assumptions: string[]
  risks: string[]
}

// ── result of calling a voice (ok or failed) ────────────────
export type VoiceResult =
  | {
      ok: true
      provider: Provider
      model: string
      response: VoiceJson
      raw_response: string
      input_tokens: number
      output_tokens: number
      cost_usd: number
      latency_ms: number
    }
  | {
      ok: false
      provider: Provider
      model: string
      error: string
      latency_ms: number
    }

// ── anonymization output ────────────────────────────────────
export interface AnonymizedVoice {
  label: AnonymousLabel
  text: string // anonymized JSON-as-text, self-refs stripped
}

export type LabelMapping = Record<AnonymousLabel, Provider>

// ── synthesis output (Opus produces this JSON) ──────────────
export interface SynthesisJson {
  individual_positions: Array<{
    label: AnonymousLabel
    core_claim: string
    key_reasoning: string
    confidence_posture: ConfidencePosture
  }>
  agreement_map: Array<{
    claim: string
    type: ConsensusType
    notes: string
  }>
  divergence_analysis: Array<{
    topic: string
    root_cause: DivergenceRootCause
    weight: DivergenceWeight
    summary: string
  }>
  blind_spots: string[]
  recommendation: {
    text: string
    why: string
    main_caveat: string
    confidence: SynthesisConfidence
  }
}

export interface SynthesisResult {
  json: SynthesisJson
  markdown: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
}

// ── full council result returned by the orchestrator ────────
export interface CouncilResult {
  query_id: string
  question: string
  voices: VoiceResult[]
  label_mapping: LabelMapping
  synthesis: SynthesisResult | null // null if too few voices succeeded
  search_results: import("@/lib/search/tavily").SearchResult[] | null
  /** Non-null when search was requested but failed — surfaced in UI as a banner. */
  search_error: string | null
  total_cost_usd: number
  total_latency_ms: number
}

// ── session context (last N syntheses, prepended to prompts) ──
export interface SessionContextEntry {
  question: string
  recommendation: string
}
