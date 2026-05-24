"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Search,
  Tag as TagIcon,
  X,
} from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import type { BriefingItem } from "@/app/api/briefings/route"

interface TagFacet {
  name: string
  count: number
}

export function BriefingsClient() {
  const [items, setItems] = useState<BriefingItem[]>([])
  const [tags, setTags] = useState<TagFacet[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  // Debounce search input by 250ms
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadBriefings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      for (const tag of selectedTags) params.append("tag", tag)
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())

      const res = await fetch(`/api/briefings?${params.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { items: BriefingItem[] }
      setItems(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load briefings")
    } finally {
      setLoading(false)
    }
  }, [selectedTags, debouncedSearch])

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch("/api/briefings/tags", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { tags: TagFacet[] }
      setTags(data.tags ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    loadBriefings()
  }, [loadBriefings])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    )
  }

  function clearFilters() {
    setSelectedTags([])
    setSearch("")
  }

  const hasFilters = selectedTags.length > 0 || debouncedSearch.length > 0

  return (
    <div>
      <FilterBar
        tags={tags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        search={search}
        onSearchChange={setSearch}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      <div className="mt-8">
        {error && (
          <ErrorState message={error} />
        )}
        {!error && loading && <LoadingState />}
        {!error && !loading && items.length === 0 && (
          <EmptyState hasFilters={hasFilters} />
        )}
        {!error && !loading && items.length > 0 && (
          <BriefingList items={items} />
        )}
      </div>
    </div>
  )
}

// ── filter bar ──────────────────────────────────────────────

function FilterBar({
  tags,
  selectedTags,
  onToggleTag,
  search,
  onSearchChange,
  onClear,
  hasFilters,
}: {
  tags: TagFacet[]
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  search: string
  onSearchChange: (s: string) => void
  onClear: () => void
  hasFilters: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-ghost" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search question, recommendation, or task name…"
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-fg-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            <TagIcon className="inline h-3 w-3 mr-1" />
            Topics
          </span>
          {tags.map((tag) => {
            const active = selectedTags.includes(tag.name)
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => onToggleTag(tag.name)}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary"
                    : "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-muted hover:text-foreground"
                }
              >
                {tag.name}
                <span className="text-fg-ghost">{tag.count}</span>
              </button>
            )
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-fg-ghost hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
          No topics yet · tag your tasks at /tasks to filter by topic
        </p>
      )}
    </div>
  )
}

// ── states ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-fg-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="font-mono text-[11px] uppercase tracking-widest">
        Loading briefings
      </span>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-critical/30 bg-critical/5 p-6 text-sm text-foreground">
      <p className="font-mono text-[10px] uppercase tracking-widest text-critical">
        Error
      </p>
      <p className="mt-2 leading-relaxed">{message}</p>
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/40 p-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
          No matches
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          No briefings match the current filters. Try a different topic or
          clear the search.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-10 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
        Empty archive
      </p>
      <p className="mt-3 font-display text-xl text-foreground">
        No scheduled task runs yet
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">
        Once a scheduled task fires, its result lands here automatically. Set
        up your first task at{" "}
        <Link
          href="/tasks"
          className="text-primary underline-offset-2 hover:underline"
        >
          /tasks
        </Link>
        .
      </p>
    </div>
  )
}

// ── briefing cards ──────────────────────────────────────────

function BriefingList({ items }: { items: BriefingItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <BriefingCard key={item.run_id} item={item} />
      ))}
    </ul>
  )
}

function BriefingCard({ item }: { item: BriefingItem }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${item.task_id}`}
            className="block font-display text-lg leading-tight tracking-tight text-foreground hover:underline"
          >
            {item.task_name}
          </Link>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            <span>
              {formatDistanceToNowStrict(new Date(item.ran_at), {
                addSuffix: true,
              })}
            </span>
            {item.confidence && (
              <span className={confidenceColor(item.confidence)}>
                Confidence · {item.confidence}
              </span>
            )}
            {item.total_cost_usd !== null && (
              <span>${item.total_cost_usd.toFixed(3)}</span>
            )}
            {item.status === "failed" && (
              <span className="inline-flex items-center gap-1 text-critical">
                <AlertCircle className="h-3 w-3" />
                Failed
              </span>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {item.question && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                Question
              </p>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                {item.question}
              </p>
            </div>
          )}

          {item.recommendation && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                Recommendation
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground">
                {item.recommendation}
              </p>
            </div>
          )}
        </div>

        {item.council_query_id && (
          <Link
            href={`/?q=${item.council_query_id}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  )
}

function confidenceColor(c: "high" | "medium" | "low"): string {
  if (c === "high") return "text-success"
  if (c === "medium") return "text-warning"
  return "text-critical"
}
