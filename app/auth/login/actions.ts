"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export type LoginState = {
  status: "idle" | "sent" | "error"
  message?: string
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
  const headerList = await headers()
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`

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
