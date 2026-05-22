import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { readAppConfig } from "@/lib/council/config"
import { readRegistry } from "@/lib/council/registry"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const [registry, appConfig, costStats] = await Promise.all([
    readRegistry(),
    readAppConfig(),
    readCostStats(user.id),
  ])

  return NextResponse.json({ registry, appConfig, costStats })
}

async function readCostStats(userId: string) {
  const admin = createAdminClient()
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

  const [{ data: todayData }, { data: monthData }] = await Promise.all([
    admin
      .from("council_queries")
      .select("total_cost_usd")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", startOfToday),
    admin
      .from("council_queries")
      .select("total_cost_usd")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", startOfMonth),
  ])

  const today_usd = (todayData ?? []).reduce(
    (sum, row) => sum + Number(row.total_cost_usd ?? 0),
    0,
  )
  const month_usd = (monthData ?? []).reduce(
    (sum, row) => sum + Number(row.total_cost_usd ?? 0),
    0,
  )
  const queries_today = (todayData ?? []).length
  const queries_month = (monthData ?? []).length

  return {
    today_usd: roundTo(today_usd, 4),
    month_usd: roundTo(month_usd, 4),
    queries_today,
    queries_month,
    monthly_budget_usd: Number(process.env.QUORUM_MONTHLY_BUDGET_USD ?? 100),
  }
}

function roundTo(n: number, decimals: number): number {
  const m = Math.pow(10, decimals)
  return Math.round(n * m) / m
}
