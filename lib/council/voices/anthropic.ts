import Anthropic from "@anthropic-ai/sdk"
import { voiceSchema } from "../schemas"
import { estimateCost } from "../cost"
import type { VoiceResult } from "../types"

const TIMEOUT_MS = 60_000

interface CallArgs {
  model: string
  system: string
  user: string
}

export async function callAnthropic(args: CallArgs): Promise<VoiceResult> {
  const start = Date.now()
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeout: TIMEOUT_MS,
  })

  try {
    const response = await client.messages.create({
      model: args.model,
      max_tokens: 1500,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    })

    const latency_ms = Date.now() - start

    const raw = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim()

    const parsed = parseJson(raw)
    const validation = voiceSchema.safeParse(parsed)
    if (!validation.success) {
      return {
        ok: false,
        provider: "anthropic",
        model: args.model,
        error: `Voice schema validation failed: ${validation.error.message}`,
        latency_ms,
      }
    }

    const input_tokens = response.usage.input_tokens
    const output_tokens = response.usage.output_tokens

    return {
      ok: true,
      provider: "anthropic",
      model: args.model,
      response: validation.data,
      raw_response: raw,
      input_tokens,
      output_tokens,
      cost_usd: estimateCost("anthropic", args.model, input_tokens, output_tokens),
      latency_ms,
    }
  } catch (err) {
    return {
      ok: false,
      provider: "anthropic",
      model: args.model,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
    }
  }
}

/**
 * Models sometimes wrap JSON in ```json fences or add prose.
 * Try strict parse first, then fall back to extracting the first
 * {...} block.
 */
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
    throw new Error(`Could not extract JSON from response: ${raw.slice(0, 200)}`)
  }
}
