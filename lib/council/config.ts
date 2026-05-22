import { createAdminClient } from "@/lib/supabase/admin"
import type { Provider } from "./types"

/**
 * App-level configuration stored in the `app_config` key-value table.
 * Distinct from model_registry (which is strictly "voice model per
 * provider"). Used for things like synthesizer model selection that
 * aren't tied to a single provider role.
 */

export interface AppConfig {
  synthesizer_provider: Provider
  synthesizer_model: string
}

const DEFAULTS: AppConfig = {
  synthesizer_provider: "anthropic",
  synthesizer_model: "claude-sonnet-4-6",
}

export async function readAppConfig(): Promise<AppConfig> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("app_config").select("key, value")

  if (error || !data) return { ...DEFAULTS }

  const map = Object.fromEntries(
    data.map((row) => [row.key as string, row.value as string]),
  )

  const provider = map.synthesizer_provider as Provider | undefined
  const model = map.synthesizer_model

  return {
    synthesizer_provider: isProvider(provider)
      ? provider
      : DEFAULTS.synthesizer_provider,
    synthesizer_model: model ?? DEFAULTS.synthesizer_model,
  }
}

export async function writeAppConfig(
  patch: Partial<AppConfig>,
): Promise<AppConfig> {
  const supabase = createAdminClient()
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value: String(value),
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from("app_config")
      .upsert(rows, { onConflict: "key" })
    if (error) throw new Error(`Failed to write app_config: ${error.message}`)
  }

  return readAppConfig()
}

function isProvider(value: string | undefined): value is Provider {
  return value === "anthropic" || value === "openai" || value === "google"
}
