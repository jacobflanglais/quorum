import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/notify/email"

export const dynamic = "force-dynamic"

/**
 * POST /api/notify/test
 *
 * Sends a one-line test email to the signed-in user's address.
 * Used to verify Resend setup without waiting for a scheduled task
 * to fire. Authenticated users only — proxy middleware already
 * enforces the owner-email gate.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    await sendEmail({
      to: user.email,
      subject: "[Quorum] Test email",
      html: `
        <div style="font-family:-apple-system,sans-serif;background:#0b0b0e;color:#f5f5f0;padding:32px;">
          <div style="font-family:Georgia,serif;font-size:24px;color:#c8923c;">Quorum</div>
          <p style="margin-top:24px;font-size:14px;line-height:1.6;">
            If you're reading this, Resend is wired correctly and the council
            can email you when scheduled tasks complete.
          </p>
          <p style="margin-top:16px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6e6e68;">
            Test sent ${new Date().toISOString()}
          </p>
        </div>
      `.trim(),
      text: "If you're reading this, Resend is wired correctly. Quorum can email you when scheduled tasks complete.",
    })
    return NextResponse.json({ ok: true, sent_to: user.email })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 },
    )
  }
}
