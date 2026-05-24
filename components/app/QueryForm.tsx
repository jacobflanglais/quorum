"use client"

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowRight, Globe, Loader2 } from "lucide-react"

interface QueryFormProps {
  pending: boolean
  onSubmit: (input: { question: string; searchEnabled: boolean }) => void
}

const SEARCH_STORAGE_KEY = "quorum:search-enabled"

export function QueryForm({ pending, onSubmit }: QueryFormProps) {
  const [value, setValue] = useState("")
  const [searchEnabled, setSearchEnabled] = useState(false)

  // Hydrate the toggle from localStorage on mount (sticky across reloads).
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(SEARCH_STORAGE_KEY)
      if (stored === "true") setSearchEnabled(true)
    } catch {
      // ignore
    }
  }, [])

  function persistSearch(next: boolean) {
    setSearchEnabled(next)
    try {
      window.localStorage.setItem(SEARCH_STORAGE_KEY, next ? "true" : "false")
    } catch {
      // ignore
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0 || pending) return
    onSubmit({ question: trimmed, searchEnabled })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed.length === 0 || pending) return
      onSubmit({ question: trimmed, searchEnabled })
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
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={searchEnabled}
              aria-label="Toggle web search"
              onClick={() => persistSearch(!searchEnabled)}
              disabled={pending}
              className={
                searchEnabled
                  ? "inline-flex items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors"
                  : "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
              }
            >
              <Globe className="h-3 w-3" />
              {searchEnabled ? "Web search on" : "Web search off"}
            </button>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-fg-ghost sm:inline">
              ⌘ Enter to convene
            </span>
          </div>
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
