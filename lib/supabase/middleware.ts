import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the auth session on every request and enforces
 * the owner-email gate.
 *
 * - If a session exists for the owner email: pass through.
 * - If a session exists for a NON-owner email: sign out and
 *   redirect to /auth/login with error.
 * - If no session: pass through (route-level gating happens
 *   in pages/route handlers as needed).
 *
 * IMPORTANT: never run code between createServerClient and
 * supabase.auth.getUser() — doing so can desync cookies and
 * sign the user out silently.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const ownerEmail = process.env.QUORUM_OWNER_EMAIL?.toLowerCase()
    if (!ownerEmail || user.email?.toLowerCase() !== ownerEmail) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("error", "not_authorized")
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
