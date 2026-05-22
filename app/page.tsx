import Link from "next/link"
import { ArrowRight, LogOut, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex flex-1 flex-col">
      <Header userEmail={user?.email ?? null} />
      <main className="flex flex-1 flex-col">
        <Hero isSignedIn={Boolean(user)} />
        <CouncilPreview />
        <Footer />
      </main>
    </div>
  )
}

function Header({ userEmail }: { userEmail: string | null }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Wordmark />
          <Badge
            variant="outline"
            className="border-accent-muted/40 text-fg-muted font-mono text-[10px] uppercase tracking-widest"
          >
            Phase 1 · Foundation
          </Badge>
        </div>

        {userEmail ? (
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11px] uppercase tracking-widest text-fg-muted sm:inline">
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
        ) : (
          <Link
            href="/auth/login"
            className="font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}

function Wordmark() {
  return (
    <span className="font-display text-[22px] tracking-tight text-foreground">
      Quorum
    </span>
  )
}

function Hero({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
        <p className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          <span className="inline-block h-px w-8 bg-accent-muted" />
          A council of frontier models
        </p>

        <h1 className="font-display text-balance text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          Ask once.
          <br />
          <span className="text-primary">Hear all three.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted">
          Quorum fans your question out to Claude, GPT, and Gemini in parallel,
          then synthesizes a single grounded answer — including where they
          agree, where they diverge, and what every one of them missed.
        </p>

        <div className="mt-12 flex items-center gap-4">
          {isSignedIn ? (
            <button
              type="button"
              disabled
              className="group inline-flex h-11 items-center gap-2 rounded-md border border-accent-muted/50 bg-accent-subtle px-5 text-sm font-medium text-primary opacity-70"
            >
              <Sparkles className="h-4 w-4" />
              Convene the council
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="group inline-flex h-11 items-center gap-2 rounded-md border border-accent-muted/50 bg-accent-subtle px-5 text-sm font-medium text-primary transition-colors hover:bg-accent-muted/20"
            >
              <Sparkles className="h-4 w-4" />
              Sign in to begin
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <span className="font-mono text-[11px] uppercase tracking-widest text-fg-ghost">
            {isSignedIn ? "Available in Phase 1c" : "Magic-link sign-in"}
          </span>
        </div>
      </div>
    </section>
  )
}

function CouncilPreview() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="mb-12 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          The council
        </p>

        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <VoiceCard
            tint="var(--color-tint-anthropic)"
            label="Voice A"
            name="Claude Opus 4.7"
            provider="Anthropic"
            posture="Deliberative · long-context"
          />
          <VoiceCard
            tint="var(--color-tint-openai)"
            label="Voice B"
            name="GPT-5.5"
            provider="OpenAI"
            posture="Structured · decisive"
          />
          <VoiceCard
            tint="var(--color-tint-google)"
            label="Voice C"
            name="Gemini 3.1 Pro"
            provider="Google"
            posture="Reasoning · multimodal"
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-relaxed text-fg-muted">
            Each voice receives the same question. Their answers are
            anonymized — labeled A, B, C in random order — before Opus 4.7
            synthesizes them. The synthesizer never knows whose answer is whose.
          </p>
          <span className="font-mono text-[11px] uppercase tracking-widest text-fg-ghost">
            Self-bias mitigation
          </span>
        </div>
      </div>
    </section>
  )
}

function VoiceCard({
  tint,
  label,
  name,
  provider,
  posture,
}: {
  tint: string
  label: string
  name: string
  provider: string
  posture: string
}) {
  return (
    <div
      className="relative bg-surface p-6"
      style={{ borderLeft: `2px solid ${tint}` }}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl tracking-tight text-foreground">
        {name}
      </p>
      <p className="mt-1 text-sm text-fg-muted">{provider}</p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-fg-ghost">
        {posture}
      </p>
    </div>
  )
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 py-10 font-mono text-[11px] uppercase tracking-widest text-fg-ghost">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>Quorum · {new Date().getFullYear()}</span>
        <span>v0.1.0 · phase 1b</span>
      </div>
    </footer>
  )
}
