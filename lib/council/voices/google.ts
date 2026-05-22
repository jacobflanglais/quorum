import { GoogleGenAI } from "@google/genai"
import { voiceSchema } from "../schemas"
import { estimateCost } from "../cost"
import type { VoiceResult } from "../types"

const TIMEOUT_MS = 60_000

interface CallArgs {
  model: string
  system: string
  user: string
}

export async function callGoogle(args: CallArgs): Promise<VoiceResult> {
  const start = Date.now()
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! })

  try {
    const result = await Promise.race([
      ai.models.generateContent({
        model: args.model,
        contents: args.user,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          maxOutputTokens: 1500,
        },
      }),
      timeout<never>(TIMEOUT_MS),
    ])

    const latency_ms = Date.now() - start
    const raw = (result.text ?? "").trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {
        ok: false,
        provider: "google",
        model: args.model,
        error: `Invalid JSON in response: ${raw.slice(0, 200)}`,
        latency_ms,
      }
    }

    const validation = voiceSchema.safeParse(parsed)
    if (!validation.success) {
      return {
        ok: false,
        provider: "google",
        model: args.model,
        error: `Voice schema validation failed: ${validation.error.message}`,
        latency_ms,
      }
    }

    const usage = result.usageMetadata
    const input_tokens = usage?.promptTokenCount ?? 0
    const output_tokens = usage?.candidatesTokenCount ?? 0

    return {
      ok: true,
      provider: "google",
      model: args.model,
      response: validation.data,
      raw_response: raw,
      input_tokens,
      output_tokens,
      cost_usd: estimateCost("google", args.model, input_tokens, output_tokens),
      latency_ms,
    }
  } catch (err) {
    return {
      ok: false,
      provider: "google",
      model: args.model,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
    }
  }
}

function timeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Provider call timed out after ${ms}ms`)),
      ms,
    ),
  )
}
