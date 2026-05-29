import { NextResponse, type NextRequest } from "next/server"
import { runModelDiscovery } from "@/lib/registry/discovery"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Vercel Cron endpoint — model auto-discovery.
 *
 * Runs weekly (see vercel.json). For every model_registry row with
 * pin_to_latest = true, adopts the newest model in the same family.
 * See lib/registry/discovery.ts for the safety guarantees.
 *
 * Auth mirrors /api/cron/scheduled-tasks: the Bearer token must match
 * CRON_SECRET, which Vercel Cron sends automatically.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const report = await runModelDiscovery()

    // Surface adoptions in the function logs for observability.
    for (const c of report.changes) {
      console.log(
        `[model-discovery] ${c.provider}/${c.family}: ${c.from} → ${c.to}`,
      )
    }

    return NextResponse.json({
      ran_at: new Date().toISOString(),
      adopted: report.changes.length,
      ...report,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
