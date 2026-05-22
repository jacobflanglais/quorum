import OpenAI from "openai"
import { voiceSchema } from "../schemas"
import { estimateCost } from "../cost"
import type { VoiceResult } from "../types"

const TIMEOUT_MS = 60_000

interface CallArgs {
  model: string
  system: string
  user: string
}

export async function callOpenAI(args: CallArgs): Promise<VoiceResult> {
  const start = Date.now()
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: TIMEOUT_MS,
  })

  try {
    // GPT-5+ and o-series models require `max_completion_tokens`.
    // Older models accept both; new param is forward-compatible.
    const response = await client.chat.completions.create({
      model: args.model,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    })

    const latency_ms = Date.now() - start
    const raw = response.choices[0]?.message?.content?.trim() ?? ""

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {
        ok: false,
        provider: "openai",
        model: args.model,
        error: `Invalid JSON in response: ${raw.slice(0, 200)}`,
        latency_ms,
      }
    }

    const validation = voiceSchema.safeParse(parsed)
    if (!validation.success) {
      return {
        ok: false,
        provider: "openai",
        model: args.model,
        error: `Voice schema validation failed: ${validation.error.message}`,
        latency_ms,
      }
    }

    const input_tokens = response.usage?.prompt_tokens ?? 0
    const output_tokens = response.usage?.completion_tokens ?? 0

    return {
      ok: true,
      provider: "openai",
      model: args.model,
      response: validation.data,
      raw_response: raw,
      input_tokens,
      output_tokens,
      cost_usd: estimateCost("openai", args.model, input_tokens, output_tokens),
      latency_ms,
    }
  } catch (err) {
    return {
      ok: false,
      provider: "openai",
      model: args.model,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
    }
  }
}
