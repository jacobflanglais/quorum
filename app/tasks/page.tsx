import Link from "next/link"
import { ArrowLeft, LogOut, Settings } from "lucide-react"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type { ScheduledTask } from "@/lib/scheduler/types"
import { TasksClient } from "./TasksClient"

export const dynamic = "force-dynamic"

export default async function TasksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: tasks } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="flex min-h-screen flex-col">
      <TasksHeader userEmail={user.email ?? ""} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to council
        </Link>

        <h1 className="mt-6 font-display text-4xl tracking-tight text-foreground">
          Scheduled tasks
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Save a question once; have the council answer it on schedule. Daily
          briefings, recurring deep-dives, anything you ask Quorum on a
          rhythm. Tasks read fresh on every cron tick — no redeploy needed.
        </p>

        <div className="mt-12">
          <TasksClient initialTasks={(tasks ?? []) as ScheduledTask[]} />
        </div>
      </main>
    </div>
  )
}

function TasksHeader({ userEmail }: { userEmail: string }) {
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
            Phase 3 · Tasks
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
