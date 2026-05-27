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

  const parsed = parseJson(raw)
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
