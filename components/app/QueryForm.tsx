"use client"

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowRight, Globe, Loader2, Telescope } from "lucide-react"

interface QueryFormProps {
  pending: boolean
  onSubmit: (input: {
    question: string
    searchEnabled: boolean
    deepResearch: boolean
  }) => void
}

const SEARCH_STORAGE_KEY = "quorum:search-enabled"
const DEEP_STORAGE_KEY = "quorum:deep-research-enabled"

export function QueryForm({ pending, onSubmit }: QueryFormProps) {
  const [value, setValue] = useState("")
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [deepResearch, setDeepResearch] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (window.localStorage.getItem(SEARCH_STORAGE_KEY) === "true") {
        setSearchEnabled(true)
      }
      if (window.localStorage.getItem(DEEP_STORAGE_KEY) === "true") {
        setDeepResearch(true)
      }
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
    // If search goes off, deep research can't be on
    if (!next && deepResearch) persistDeep(false)
  }

  function persistDeep(next: boolean) {
    setDeepResearch(next)
    try {
      window.localStorage.setItem(DEEP_STORAGE_KEY, next ? "true" : "false")
    } catch {
      // ignore
    }
    // Deep implies search
    if (next && !searchEnabled) persistSearch(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0 || pending) return
    onSubmit({ question: trimmed, searchEnabled, deepResearch })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed.length === 0 || pending) return
      onSubmit({ question: trimmed, searchEnabled, deepResearch })
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <ModePill
              active={searchEnabled}
              disabled={pending}
              icon={<Globe className="h-3 w-3" />}
              onLabel="Web search on"
              offLabel="Web search off"
              onClick={() => persistSearch(!searchEnabled)}
            />
            <ModePill
              active={deepResearch}
              disabled={pending || !searchEnabled}
              icon={<Telescope className="h-3 w-3" />}
              onLabel="Deep research on"
              offLabel="Deep research off"
              onClick={() => persistDeep(!deepResearch)}
              hint={!searchEnabled ? "Requires web search" : undefined}
            />
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-fg-ghost md:inline">
              Enter to convene · Shift+Enter for newline
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

function ModePill({
  active,
  disabled,
  icon,
  onLabel,
  offLabel,
  onClick,
  hint,
}: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  onLabel: string
  offLabel: string
  onClick: () => void
  hint?: string
}) {
  const className = active
    ? "inline-flex items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground disabled:opacity-50 disabled:hover:text-fg-muted disabled:cursor-not-allowed"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={className}
    >
      {icon}
      {active ? onLabel : offLabel}
    </button>
  )
}
