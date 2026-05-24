import type {
  LabelMapping,
  Provider,
  SynthesisJson,
  VoiceJson,
} from "@/lib/council/types"

export interface HistoryItem {
  id: string
  question: string
  status: "pending" | "completed" | "failed"
  total_cost_usd: number | null
  created_at: string
  completed_at: string | null
  recommendation: string | null
  confidence: "high" | "medium" | "low" | null
}

export interface ClientVoice {
  provider: Provider
  model: string
  anonymous_label: "A" | "B" | "C"
  ok: boolean
  response_json: VoiceJson | null
  error: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  latency_ms: number | null
}

export interface ClientSynthesis {
  json: SynthesisJson
  recommendation: string | null
  confidence: "high" | "medium" | "low" | null
  label_mapping: LabelMapping
  cost_usd: number | null
  latency_ms: number | null
}

export interface CurrentResult {
  query_id: string
  question: string
  voices: ClientVoice[]
  synthesis: ClientSynthesis | null
  search_results: import("@/lib/search/tavily").SearchResult[] | null
  total_cost_usd: number
  total_latency_ms: number
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "GPT",
  google: "Gemini",
}

export const PROVIDER_COMPANY: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
}

export const PROVIDER_TINT: Record<Provider, string> = {
  anthropic: "var(--color-tint-anthropic)",
  openai: "var(--color-tint-openai)",
  google: "var(--color-tint-google)",
}
