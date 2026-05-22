import { createAdminClient } from "@/lib/supabase/admin"
import type { Provider } from "./types"

export interface RegistryEntry {
  provider: Provider
  current_model: string
  fallback_model: string | null
  pin_to_latest: boolean
}

/**
 * Read the model_registry table. Returns one entry per provider.
 * Server-side only — uses the admin client.
 */
export async function readRegistry(): Promise<RegistryEntry[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("model_registry")
    .select("provider, current_model, fallback_model, pin_to_latest")

  if (error) throw new Error(`Failed to read model_registry: ${error.message}`)
  if (!data) return []

  return data as RegistryEntry[]
}

export function findProviderModel(
  entries: RegistryEntry[],
  provider: Provider,
): { model: string; fallback: string | null } {
  const entry = entries.find((e) => e.provider === provider)
  if (!entry) {
    throw new Error(`No model_registry entry for provider: ${provider}`)
  }
  return { model: entry.current_model, fallback: entry.fallback_model }
}
