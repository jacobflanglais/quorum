import type {
  AnonymizedVoice,
  AnonymousLabel,
  LabelMapping,
  Provider,
  VoiceResult,
} from "./types"

/**
 * Anonymize successful voice responses for the synthesizer.
 *
 * 1. Shuffle the providers into a random A/B/C order per call.
 * 2. Serialize each voice's JSON response and strip self-references
 *    (provider/model names) — defense in depth on top of the
 *    voice prompt's "don't name yourself" rule.
 *
 * Returns the anonymized voices in label order (A, B, C) and a
 * mapping for audit/UI use (so we can show the real model name
 * behind each raw response toggle).
 */

const LABELS: readonly AnonymousLabel[] = ["A", "B", "C"]

const SELF_REFERENCE_PATTERN =
  /\b(claude|anthropic|chatgpt|gpt-?\d+(?:\.\d+)?(?:-[a-z]+)?|openai|gemini|bard|google ai|google's gemini)\b/gi

export interface AnonymizeResult {
  anonymized: AnonymizedVoice[]
  mapping: LabelMapping
}

export function anonymize(
  successfulVoices: Extract<VoiceResult, { ok: true }>[],
  random: () => number = Math.random,
): AnonymizeResult {
  if (successfulVoices.length === 0) {
    throw new Error("Cannot anonymize zero voices")
  }
  if (successfulVoices.length > LABELS.length) {
    throw new Error(
      `Anonymizer supports up to ${LABELS.length} voices; received ${successfulVoices.length}`,
    )
  }

  const shuffled = fisherYatesShuffle(successfulVoices, random)

  const anonymized: AnonymizedVoice[] = []
  const mapping = {} as LabelMapping

  shuffled.forEach((voice, idx) => {
    const label = LABELS[idx]!
    mapping[label] = voice.provider
    anonymized.push({
      label,
      text: redactSelfReferences(stableJsonStringify(voice.response)),
    })
  })

  return { anonymized, mapping }
}

function fisherYatesShuffle<T>(input: readonly T[], random: () => number): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function redactSelfReferences(text: string): string {
  return text.replace(SELF_REFERENCE_PATTERN, "[redacted]")
}

function stableJsonStringify(value: unknown): string {
  // Keys in stable order for reproducibility — avoids one model
  // accidentally outing itself via key ordering quirks.
  return JSON.stringify(value, sortReplacer, 2)
}

function sortReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    )
  }
  return value
}

export function mappingToInverse(
  mapping: LabelMapping,
): Record<Provider, AnonymousLabel | undefined> {
  return Object.fromEntries(
    Object.entries(mapping).map(([label, provider]) => [
      provider,
      label as AnonymousLabel,
    ]),
  ) as Record<Provider, AnonymousLabel | undefined>
}
