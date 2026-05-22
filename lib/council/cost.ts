import type { Provider } from "./types"

/**
 * Per-million-token pricing in USD by provider/model family.
 *
 * Update these when providers change pricing. The cost calculator
 * matches by model-name substring so "claude-opus-4-7" routes to
 * the "opus" tier, "gpt-5.5" to the "gpt-5" tier, etc.
 *
 * These are rough but in the right order of magnitude. Verify
 * against provider pricing pages before relying on cost reports.
 */
type Tier = { input: number; output: number; label: string }

const PRICING: Record<Provider, Tier[]> = {
  anthropic: [
    { label: "opus", input: 15, output: 75 },
    { label: "sonnet", input: 3, output: 15 },
    { label: "haiku", input: 1, output: 5 },
  ],
  openai: [
    { label: "gpt-5", input: 10, output: 40 },
    { label: "gpt-4", input: 2.5, output: 10 },
    { label: "o-", input: 15, output: 60 }, // reasoning models like o1, o3
  ],
  google: [
    { label: "pro", input: 2, output: 10 },
    { label: "flash", input: 0.15, output: 0.6 },
  ],
}

function tierFor(provider: Provider, model: string): Tier {
  const lowered = model.toLowerCase()
  const tiers = PRICING[provider]
  const match = tiers.find((t) => lowered.includes(t.label))
  return match ?? tiers[0]!
}

export function estimateCost(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const tier = tierFor(provider, model)
  const cost =
    (inputTokens / 1_000_000) * tier.input +
    (outputTokens / 1_000_000) * tier.output
  return Math.round(cost * 1_000_000) / 1_000_000 // 6 decimal places
}
