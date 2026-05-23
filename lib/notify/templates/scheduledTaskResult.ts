import type { SynthesisJson } from "@/lib/council/types"

/**
 * Email template for a completed scheduled task.
 *
 * Editorial dark aesthetic matching the Quorum web UI — most modern
 * email clients render HTML CSS well enough for this to look right
 * in Gmail, Apple Mail, Outlook web. Plain-text fallback for clients
 * that strip HTML.
 */

export interface EmailInput {
  taskName: string
  question: string
  synthesis: SynthesisJson | null
  appUrl: string
  queryId: string
  ranAt: string // ISO timestamp
  failed?: boolean
  failureMessage?: string
}

export function renderScheduledTaskEmail(input: EmailInput): {
  subject: string
  html: string
  text: string
} {
  if (input.failed) return renderFailureEmail(input)
  return renderSuccessEmail(input)
}

function renderSuccessEmail(input: EmailInput): {
  subject: string
  html: string
  text: string
} {
  const s = input.synthesis
  const rec = s?.recommendation
  const subject = `[Quorum] ${input.taskName}`

  const ts = formatTimestamp(input.ranAt)

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5f5f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b0e;">
    <tr>
      <td align="center" style="padding:32px 16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #26262e;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:-0.02em;color:#f5f5f0;">Quorum</div>
              <div style="margin-top:8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#a8a8a0;">${escapeHtml(input.taskName)} · ${escapeHtml(ts)}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 0 16px;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6e6e68;margin-bottom:8px;">Question</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.4;letter-spacing:-0.01em;color:#f5f5f0;">${escapeHtml(input.question)}</div>
            </td>
          </tr>

          ${
            rec
              ? `
          <tr>
            <td style="padding:24px 0 8px;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6e6e68;margin-bottom:8px;">Recommendation · ${escapeHtml(rec.confidence)} confidence</div>
              <div style="padding:20px;border:1px solid #7a5b26;background:rgba(200,146,60,0.08);border-radius:8px;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.5;color:#f5f5f0;">${escapeHtml(rec.text)}</div>
                <div style="margin-top:16px;font-size:14px;line-height:1.6;color:#a8a8a0;">${escapeHtml(rec.why)}</div>
                <div style="margin-top:20px;padding-top:16px;border-top:1px solid #7a5b26;font-size:13px;color:#a8a8a0;">
                  <strong style="color:#c8923c;font-weight:600;">Main caveat:</strong> ${escapeHtml(rec.main_caveat)}
                </div>
              </div>
            </td>
          </tr>`
              : ""
          }

          ${
            s && s.blind_spots.length > 0
              ? `
          <tr>
            <td style="padding:24px 0 8px;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6e6e68;margin-bottom:12px;">Blind spots</div>
              <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#a8a8a0;">
                ${s.blind_spots.map((b) => `<li style="margin-bottom:6px;">${escapeHtml(b)}</li>`).join("")}
              </ul>
            </td>
          </tr>`
              : ""
          }

          <tr>
            <td style="padding:32px 0;">
              <a href="${escapeAttr(input.appUrl)}" style="display:inline-block;padding:12px 20px;border:1px solid #7a5b26;background:rgba(200,146,60,0.08);color:#c8923c;text-decoration:none;font-size:13px;font-weight:500;border-radius:6px;letter-spacing:0.02em;">
                Open full synthesis in Quorum →
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 0 32px;border-top:1px solid #26262e;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6e6e68;">
              Quorum · Claude Opus 4.7 · GPT-5.5 · Gemini 3.1 Pro · synthesized by Sonnet 4.6
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `[Quorum] ${input.taskName} · ${ts}`,
    "",
    `Question`,
    input.question,
    "",
    ...(rec
      ? [
          `Recommendation (${rec.confidence} confidence)`,
          rec.text,
          "",
          rec.why,
          "",
          `Main caveat: ${rec.main_caveat}`,
          "",
        ]
      : []),
    ...(s && s.blind_spots.length > 0
      ? [
          "Blind spots:",
          ...s.blind_spots.map((b) => `  - ${b}`),
          "",
        ]
      : []),
    `Full synthesis: ${input.appUrl}`,
    "",
    "—",
    "Quorum · Claude Opus 4.7 · GPT-5.5 · Gemini 3.1 Pro · synthesized by Sonnet 4.6",
  ].join("\n")

  return { subject, html, text }
}

function renderFailureEmail(input: EmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `[Quorum] ${input.taskName} failed`
  const ts = formatTimestamp(input.ranAt)

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#0b0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5f5f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b0e;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
          <tr>
            <td>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#f5f5f0;">Quorum</div>
              <div style="margin-top:8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#a8a8a0;">${escapeHtml(input.taskName)} · ${escapeHtml(ts)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;">
              <div style="padding:20px;border:1px solid #b8635a;background:rgba(184,99,90,0.05);border-radius:8px;">
                <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8635a;margin-bottom:8px;">Run failed</div>
                <div style="font-size:14px;line-height:1.6;color:#f5f5f0;">${escapeHtml(input.failureMessage ?? "Unknown error")}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <a href="${escapeAttr(input.appUrl)}" style="display:inline-block;padding:12px 20px;border:1px solid #26262e;color:#a8a8a0;text-decoration:none;font-size:13px;border-radius:6px;">
                Open task in Quorum →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `[Quorum] ${input.taskName} failed at ${ts}`,
    "",
    input.failureMessage ?? "Unknown error",
    "",
    `Task: ${input.appUrl}`,
  ].join("\n")

  return { subject, html, text }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return iso
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
