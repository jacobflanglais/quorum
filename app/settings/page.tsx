import Link from "next/link"
import { ArrowLeft, LogOut } from "lucide-react"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { readAppConfig } from "@/lib/council/config"
import { readRegistry } from "@/lib/council/registry"
import { SettingsClient } from "./SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [registry, appConfig] = await Promise.all([
    readRegistry(),
    readAppConfig(),
  ])

  // Server-side cost stats (no need for an extra API round-trip here)
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString()
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString()

  const [{ data: todayRows }, { data: monthRows }] = await Promise.all([
    supabase
      .from("council_queries")
      .select("total_cost_usd")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", startOfToday),
    supabase
      .from("council_queries")
      .select("total_cost_usd")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", startOfMonth),
  ])

  const costStats = {
    today_usd: sum(todayRows),
    month_usd: sum(monthRows),
    queries_today: (todayRows ?? []).length,
    queries_month: (monthRows ?? []).length,
    monthly_budget_usd: Number(process.env.QUORUM_MONTHLY_BUDGET_USD ?? 100),
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SettingsHeader userEmail={user.email ?? ""} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to council
        </Link>

        <h1 className="mt-6 font-display text-4xl tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Configure which model represents each provider in the council, and
          which model synthesizes their answers. Changes apply to the next
          query — no redeploy needed.
        </p>

        <div className="mt-12">
          <SettingsClient
            initialRegistry={registry}
            initialAppConfig={appConfig}
            initialCostStats={costStats}
          />
        </div>
      </main>
    </div>
  )
}

function sum(rows: { total_cost_usd: number | null }[] | null): number {
  if (!rows) return 0
  return rows.reduce((total, r) => total + Number(r.total_cost_usd ?? 0), 0)
}

function SettingsHeader({ userEmail }: { userEmail: string }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-display text-[22px] tracking-tight text-foreground"
          >
            Quorum
          </Link>
          <Badge
            variant="outline"
            className="border-accent-muted/40 text-fg-muted font-mono text-[10px] uppercase tracking-widest"
          >
            Phase 1f · Settings
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-fg-muted lg:inline">
            {userEmail}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
