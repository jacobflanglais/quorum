import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Provider } from "@/lib/council/types"

/**
 * Model auto-discovery for the model_registry table.
 *
 * Anthropic model IDs are pinned snapshots — the API never upgrades
 * you across versions. This job closes that gap: for every registry
 * row with `pin_to_latest = true`, it finds the newest model in the
 * SAME family as the current pick (e.g. opus → opus) and adopts it.
 *
 * Safety properties:
 *   - Only rows with pin_to_latest = true are ever touched.
 *   - The family is derived from the current model, so discovery can
 *     only move opus→opus, never opus→haiku (no silent tier change).
 *   - fallback_model is never modified.
 *   - "Newest" is decided by the model's released-at date, not by
 *     parsing version numbers out of the id.
 *   - A no-change run is a no-op (no write, so updated_at is stable).
 *
 * Currently only Anthropic has a discovery implementation. Pinned rows
 * for providers without one are skipped and reported, not failed.
 */

export interface DiscoveryChange {
  provider: Provider
  family: string
  from: string
  to: string
}

export interface DiscoverySkip {
  provider: Provider
  reason: string
}

export interface DiscoveryReport {
  changes: DiscoveryChange[]
  skipped: DiscoverySkip[]
}

/** Anthropic model families. These tokens never co-occur in one id. */
const ANTHROPIC_FAMILIES = ["opus", "sonnet", "haiku"] as const

function familyOf(model: string): string | null {
  const lowered = model.toLowerCase()
  return ANTHROPIC_FAMILIES.find((f) => lowered.includes(f)) ?? null
}

/**
 * Return the id of the newest Anthropic model in `family`, or null if
 * none is found. Newest = latest `created_at` (RFC 3339 release date).
 */
async function newestAnthropicInFamily(family: string): Promise<string | null> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeout: 30_000, // models.list is fast; cap it so a hang can't eat the whole cron budget
  })

  let newestId: string | null = null
  let newestAt = -Infinity

  // Auto-paginates across all available models.
  for await (const model of client.models.list({ limit: 1000 })) {
    // Confine to the Claude namespace so a stray third-party id that
    // happens to contain a family word can never be adopted.
    if (!model.id.startsWith("claude-")) continue
    if (!model.id.toLowerCase().includes(family)) continue
    const at = Date.parse(model.created_at)
    const score = Number.isNaN(at) ? -Infinity : at
    if (score > newestAt) {
      newestAt = score
      newestId = model.id
    }
  }

  return newestId
}

type ProviderDiscovery = (family: string) => Promise<string | null>

const DISCOVERY: Partial<Record<Provider, ProviderDiscovery>> = {
  anthropic: newestAnthropicInFamily,
}

/**
 * Run discovery across all pinned registry rows and apply any updates.
 * Returns a report of what changed and what was skipped.
 */
export async function runModelDiscovery(): Promise<DiscoveryReport> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("model_registry")
    .select("provider, current_model, pin_to_latest")
    .eq("pin_to_latest", true)

  if (error) throw new Error(`Failed to read model_registry: ${error.message}`)

  const changes: DiscoveryChange[] = []
  const skipped: DiscoverySkip[] = []

  for (const row of data ?? []) {
    const provider = row.provider as Provider
    const current = row.current_model as string

    const discover = DISCOVERY[provider]
    if (!discover) {
      skipped.push({ provider, reason: "no discovery implementation" })
      continue
    }

    const family = familyOf(current)
    if (!family) {
      skipped.push({ provider, reason: `unknown family for "${current}"` })
      continue
    }

    let latest: string | null
    try {
      latest = await discover(family)
    } catch (err) {
      skipped.push({
        provider,
        reason: `discovery error: ${err instanceof Error ? err.message : String(err)}`,
      })
      continue
    }

    if (!latest) {
      skipped.push({ provider, reason: `no models found in family "${family}"` })
      continue
    }

    if (latest === current) continue // already newest — no write

    const { error: updateError } = await supabase
      .from("model_registry")
      .update({ current_model: latest })
      .eq("provider", provider)
      .eq("pin_to_latest", true) // re-assert: never write to an unpinned row

    if (updateError) {
      skipped.push({ provider, reason: `update failed: ${updateError.message}` })
      continue
    }

    changes.push({ provider, family, from: current, to: latest })
  }

  return { changes, skipped }
}
