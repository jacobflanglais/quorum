import { Resend } from "resend"

/**
 * Resend wrapper.
 *
 * Setup checklist:
 * - RESEND_API_KEY: from https://resend.com/api-keys
 * - RESEND_FROM_EMAIL: e.g. "Quorum <onboarding@resend.dev>" for testing
 *   (only sends to your own verified email until you add a domain)
 *
 * Without a verified sending domain, Resend restricts you to sending
 * to the email address you signed up with — perfect for a single-user
 * app, no domain required.
 */

let cached: Resend | null = null

function client(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set")
  }
  if (!cached) cached = new Resend(process.env.RESEND_API_KEY)
  return cached
}

export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? "Quorum <onboarding@resend.dev>"

  const { error } = await client().emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  })

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`)
  }
}
