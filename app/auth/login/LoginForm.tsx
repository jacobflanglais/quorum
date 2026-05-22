"use client"

import { useActionState } from "react"
import { ArrowRight, Mail } from "lucide-react"
import { requestMagicLink, type LoginState } from "./actions"

const initial: LoginState = { status: "idle" }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initial)

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label
        htmlFor="email"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted"
      >
        Email
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-ghost" />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending || state.status === "sent"}
          placeholder="you@domain.com"
          className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={pending || state.status === "sent"}
        className="group inline-flex h-11 items-center justify-center gap-2 rounded-md border border-accent-muted/50 bg-accent-subtle px-5 text-sm font-medium text-primary transition-colors hover:bg-accent-muted/20 disabled:opacity-60"
      >
        {pending
          ? "Sending..."
          : state.status === "sent"
            ? "Link sent"
            : "Send sign-in link"}
        {state.status !== "sent" && (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </button>

      {state.message && (
        <p
          className={`mt-2 text-sm leading-relaxed ${
            state.status === "error" ? "text-critical" : "text-fg-muted"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
