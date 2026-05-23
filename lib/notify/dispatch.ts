import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "./email"
import { sendPushToUser } from "./push"
import { renderScheduledTaskEmail } from "./templates/scheduledTaskResult"
import type {
  ScheduledTask,
  ScheduledTaskRunDetail,
} from "@/lib/scheduler/types"
import type { SynthesisJson } from "@/lib/council/types"

/**
 * Post-run notification dispatcher.
 *
 * Looks up the task owner's email via the profiles table, then sends
 * a notification through every enabled channel. Failures are logged
 * but never thrown — notifications should never block the scheduler.
 *
 * Push delivery lands in Phase 4b; the scaffolding is here but
 * gated on a future subscription table that doesn't exist yet.
 */

export interface DispatchArgs {
  admin: SupabaseClient
  task: ScheduledTask
  councilQueryId: string | null
  failed: boolean
  failureMessage?: string
}

export async function dispatchTaskNotifications(
  args: DispatchArgs,
): Promise<void> {
  if (!args.task.notify_email && !args.task.notify_push) return

  // Look up owner email and the synthesis for body content in parallel
  const [profileRes, contextRes] = await Promise.all([
    args.admin
      .from("profiles")
      .select("email")
      .eq("id", args.task.user_id)
      .maybeSingle(),
    args.councilQueryId
      ? args.admin
          .from("council_queries")
          .select(
            `
            question,
            syntheses ( synthesis_json )
          `,
          )
          .eq("id", args.councilQueryId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const email = profileRes.data?.email as string | undefined
  if (!email) return // can't notify without an address

  const cqRow = contextRes.data as
    | { question: string; syntheses: { synthesis_json: SynthesisJson } | { synthesis_json: SynthesisJson }[] | null }
    | null
  const question = cqRow?.question ?? args.task.prompt
  const synthesisRow = cqRow
    ? Array.isArray(cqRow.syntheses)
      ? cqRow.syntheses[0]
      : cqRow.syntheses
    : null
  const synthesis = synthesisRow?.synthesis_json ?? null

  const appUrl = buildAppUrl(args.councilQueryId)

  const payload = renderScheduledTaskEmail({
    taskName: args.task.name,
    question,
    synthesis,
    appUrl,
    queryId: args.councilQueryId ?? "",
    ranAt: new Date().toISOString(),
    failed: args.failed,
    failureMessage: args.failureMessage,
  })

  if (args.task.notify_email) {
    try {
      await sendEmail({
        to: email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      })
    } catch (err) {
      console.error(
        `[notify] email send failed for task ${args.task.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  if (args.task.notify_push) {
    try {
      const recommendationText =
        synthesis?.recommendation.text ??
        (args.failed
          ? `Run failed: ${args.failureMessage ?? "Unknown error"}`
          : "Council answered — open Quorum for the synthesis.")
      await sendPushToUser(args.admin, args.task.user_id, {
        title: `Quorum · ${args.task.name}`,
        body: truncate(recommendationText, 180),
        url: appUrl,
        tag: `task-${args.task.id}`,
      })
    } catch (err) {
      console.error(
        `[notify] push send failed for task ${args.task.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

function buildAppUrl(queryId: string | null): string {
  const base =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://quorum-rouge.vercel.app"
  return queryId ? `${base}/?q=${queryId}` : base
}
