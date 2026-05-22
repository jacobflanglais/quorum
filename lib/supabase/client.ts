import { createBrowserClient } from "@supabase/ssr"

/**
 * Supabase client for use in browser/client components.
 * Reads cookies set by the server-side session handlers.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
