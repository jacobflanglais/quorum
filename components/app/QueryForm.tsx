"use client"

import { useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

interface QueryFormProps {
  pending: boolean
  onSubmit: (question: string) => void
}

export function QueryForm({ pending, onSubmit }: QueryFormProps) {
  const [value, setValue] = useState("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0 || pending) return
    onSubmit(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed.length === 0 || pending) return
      onSubmit(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="overflow-hidden rounded-lg border border-border bg-surface focus-within:border-accent-muted/50">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the council..."
          rows={4}
          disabled={pending}
          className="w-full resize-none border-0 bg-transparent px-4 py-3 text-base text-foreground placeholder:text-fg-ghost focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            ⌘ Enter to convene · Same prompt to all three
          </span>
          <button
            type="submit"
            disabled={pending || value.trim().length === 0}
            className="group inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-4 text-xs font-medium uppercase tracking-widest text-primary transition-colors hover:bg-accent-muted/20 disabled:opacity-40"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Convening
              </>
            ) : (
              <>
                Convene
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
