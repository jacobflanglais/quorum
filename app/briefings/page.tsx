import Link from "next/link"
import { ArrowLeft, CalendarClock, LogOut, Settings } from "lucide-react"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { BriefingsClient } from "./BriefingsClient"

export const dynamic = "force-dynamic"

export default async function BriefingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="flex min-h-screen flex-col">
      <BriefingsHeader userEmail={user.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to council
        </Link>

        <h1 className="mt-6 font-display text-4xl tracking-tight text-foreground">
          Briefings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Every council answer from your scheduled tasks, browsable by topic
          and searchable by keyword. Tag tasks (AI industry, markets, anything)
          to filter the archive here.
        </p>

        <div className="mt-10">
          <BriefingsClient />
        </div>
      </main>
    </div>
  )
}

function BriefingsHeader({ userEmail }: { userEmail: string }) {
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
            Phase 5 · Briefings
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tasks</span>
          </Link>
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
