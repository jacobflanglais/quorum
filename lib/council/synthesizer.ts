import Anthropic from "@anthropic-ai/sdk"
import { synthesisSchema } from "./schemas"
import { estimateCost } from "./cost"
import { buildSynthesizerMessages } from "./prompts"
import { renderSynthesisMarkdown } from "./markdown"
import type {
  AnonymizedVoice,
  SessionContextEntry,
  SynthesisResult,
} from "./types"
import type { SearchResult } from "@/lib/search/tavily"

const TIMEOUT_MS = 90_000

export interface SynthesizeArgs {
  model: string
  question: string
  context: SessionContextEntry[]
  anonymizedVoices: AnonymizedVoice[]
  sources?: SearchResult[]
  groundedAnswer?: string | null
  webSearchEnabled: boolean
  userTimeZone?: string | null
}

/**
 * Call Opus 4.7 to synthesize the anonymized voices into a single
 * grounded answer following the A–E protocol.
 *
 * Returns both the structured JSON (for rich UI rendering) and a
 * markdown-rendered version (for raw display/export).
 */
export async function synthesize(args: SynthesizeArgs): Promise<SynthesisResult> {
  const start = Date.now()
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeout: TIMEOUT_MS,
  })

  const { system, user } = buildSynthesizerMessages({
    question: args.question,
    context: args.context,
    anonymizedVoices: args.anonymizedVoices,
    sources: args.sources,
    groundedAnswer: args.groundedAnswer,
    webSearchEnabled: args.webSearchEnabled,
    userTimeZone: args.userTimeZone,
  })

  const response = await client.messages.create({
    model: args.model,
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
  })

  const latency_ms = Date.now() - start

  const raw = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim()

  const parsed = repairSynthesisJson(parseJson(raw))
  const validation = synthesisSchema.safeParse(parsed)
  if (!validation.success) {
    throw new Error(
      `Synthesis schema validation failed: ${validation.error.message}\n\nRaw output:\n${raw.slice(0, 500)}`,
    )
  }

  const input_tokens = response.usage.input_tokens
  const output_tokens = response.usage.output_tokens

  return {
    json: validation.data,
    markdown: renderSynthesisMarkdown(validation.data),
    input_tokens,
    output_tokens,
    cost_usd: estimateCost(
      "anthropic",
      args.model,
      input_tokens,
      output_tokens,
    ),
    latency_ms,
  }
}

/**
 * Best-effort cleanup of the synthesizer's JSON before strict validation.
 *
 * Strips entries inside array-of-objects fields whose required string
 * keys are null/undefined/empty. This catches the failure mode where
 * the model emits a placeholder object for a missing voice (e.g.
 * `individual_positions[2] = { label: "C", core_claim: null, ... }`)
 * which would otherwise fail validation and 500 the whole request.
 *
 * If the cleanup leaves nothing salvageable, the original input is
 * returned unchanged so validation surfaces the real error.
 */
function repairSynthesisJson(input: unknown): unknown {
  if (!isObject(input)) return input

  const cleaned = { ...input }

  cleaned.individual_positions = filterValidObjects(
    input.individual_positions,
    ["core_claim", "key_reasoning"],
  )
  cleaned.agreement_map = filterValidObjects(input.agreement_map, ["claim"])
  cleaned.divergence_analysis = filterValidObjects(input.divergence_analysis, [
    "topic",
    "summary",
  ])
  if (Array.isArray(input.blind_spots)) {
    cleaned.blind_spots = input.blind_spots.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    )
  }

  return cleaned
}

function filterValidObjects(value: unknown, requiredStringKeys: string[]): unknown {
  if (!Array.isArray(value)) return value
  return value.filter((item) => {
    if (!isObject(item)) return false
    return requiredStringKeys.every((k) => {
      const v = item[k]
      return typeof v === "string" && v.trim().length > 0
    })
  })
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1])
      } catch {
        // fall through
      }
    }
    const first = raw.indexOf("{")
    const last = raw.lastIndexOf("}")
    if (first >= 0 && last > first) {
      return JSON.parse(raw.slice(first, last + 1))
    }
    throw new Error(`Could not extract JSON from synthesis output: ${raw.slice(0, 200)}`)
  }
}
