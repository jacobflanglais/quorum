import Link from "next/link"
import { ArrowLeft, LogOut, Settings } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type {
  ScheduledTask,
  ScheduledTaskRunDetail,
} from "@/lib/scheduler/types"
import { TaskDetailClient } from "./TaskDetailClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: task } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!task) notFound()

  const { data: runRows } = await supabase
    .from("scheduled_task_runs")
    .select(
      `
      id, task_id, council_query_id, status, ran_at, error,
      council_queries ( question, syntheses ( recommendation, confidence ) )
    `,
    )
    .eq("task_id", id)
    .order("ran_at", { ascending: false })
    .limit(50)

  const runs: ScheduledTaskRunDetail[] = (runRows ?? []).map((row) => {
    const cq = Array.isArray(row.council_queries)
      ? row.council_queries[0]
      : row.council_queries
    const synth = cq
      ? Array.isArray(cq.syntheses)
        ? cq.syntheses[0]
        : cq.syntheses
      : null
    return {
      id: row.id as string,
      task_id: row.task_id as string,
      council_query_id: row.council_query_id as string | null,
      status: row.status as "pending" | "completed" | "failed",
      ran_at: row.ran_at as string,
      error: row.error as string | null,
      question: (cq?.question as string | undefined) ?? null,
      recommendation: (synth?.recommendation as string | undefined) ?? null,
      confidence: (synth?.confidence as "high" | "medium" | "low" | undefined) ?? null,
    }
  })

  return (
    <div className="flex min-h-screen flex-col">
      <DetailHeader userEmail={user.email ?? ""} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to all tasks
        </Link>

        <TaskDetailClient initialTask={task as ScheduledTask} initialRuns={runs} />
      </main>
    </div>
  )
}

function DetailHeader({ userEmail }: { userEmail: string }) {
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
            Phase 3 · Task
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-fg-muted lg:inline">
            {userEmail}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
