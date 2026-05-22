import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS.
 * Server-side only. Never import from a client component.
 *
 * Used by: cron jobs, the council orchestrator (for writes that
 * span multiple users in future multi-user scenarios), and any
 * admin operation that needs to ignore RLS.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is required for admin client")
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
