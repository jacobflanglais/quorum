"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type LoginState = {
  status: "idle" | "sent" | "error"
  message?: string
}

async function getOrigin() {
  const headerList = await headers()
  return (
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`
  )
}

/**
 * Server action for magic-link sign-in.
 *
 * Always returns the same "check your email" response regardless of
 * whether the email matches the owner — this prevents enumeration
 * of the owner address. Only the owner email actually triggers a send.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email")
  if (typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
    return { status: "error", message: "Email is required." }
  }

  const email = rawEmail.trim().toLowerCase()
  const ownerEmail = process.env.QUORUM_OWNER_EMAIL?.toLowerCase()

  // Identical response either way — owner-email gate is silent.
  const successResponse: LoginState = {
    status: "sent",
    message: "If that email has access, a sign-in link is on its way.",
  }

  if (!ownerEmail || email !== ownerEmail) {
    // Don't send anything, don't create a ghost user. Same response shape.
    return successResponse
  }

  const supabase = await createClient()
  const origin = await getOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    return {
      status: "error",
      message: "Could not send sign-in link. Try again in a moment.",
    }
  }

  return successResponse
}

/**
 * Server action for Google OAuth sign-in.
 *
 * Initiates the PKCE OAuth flow with Google. The flow completes at
 * `/auth/callback`, which exchanges the code for a session. The
 * owner-email gate in middleware then bounces any non-owner Google
 * account back to `/auth/login?error=not_authorized`.
 *
 * We intentionally do NOT pre-check the email here — Google doesn't
 * tell us who the user is until after the redirect dance. The
 * middleware is the single source of truth for the gate.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient()
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        // Force account chooser so the user can pick the right Google
        // account on a shared device — and surface the not_authorized
        // gate instead of silently signing in to the wrong one.
        prompt: "select_account",
      },
    },
  })

  if (error || !data?.url) {
    redirect("/auth/login?error=oauth_failed")
  }

  redirect(data.url)
}
