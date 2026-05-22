import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { LoginForm } from "./LoginForm"

type SearchParams = Promise<{ error?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error } = await searchParams
  const notAuthorized = error === "not_authorized"

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-foreground"
        >
          Quorum
        </Link>

        <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          Sign in
        </p>
        <h1 className="mt-4 font-display text-3xl leading-tight tracking-tight text-foreground">
          Convene the council.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Enter your email. We&rsquo;ll send a one-time sign-in link.
        </p>

        {notAuthorized && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-md border border-critical/30 bg-critical/5 p-3 text-sm text-foreground"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
            <span>
              That account isn&rsquo;t authorized. Quorum is a private,
              single-user app. If this is your account, double-check the email.
            </span>
          </div>
        )}

        <div className="mt-8">
          <LoginForm />
        </div>

        <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-ghost">
          Phase 1b · Auth
        </p>
      </div>
    </div>
  )
}
