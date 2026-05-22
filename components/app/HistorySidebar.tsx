"use client"

import { History as HistoryIcon, AlertTriangle } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { HistoryItem } from "./types"

interface HistorySidebarProps {
  items: HistoryItem[]
  currentQueryId: string | null
  onSelect: (id: string) => void
}

export function HistorySidebar({
  items,
  currentQueryId,
  onSelect,
}: HistorySidebarProps) {
  return (
    <>
      {/* Mobile trigger */}
      <Sheet>
        <SheetTrigger
          aria-label="Open history"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground md:hidden"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          History
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-r border-border bg-background p-0">
          <SheetTitle className="sr-only">Query history</SheetTitle>
          <HistoryList
            items={items}
            currentQueryId={currentQueryId}
            onSelect={onSelect}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop persistent sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:block">
        <HistoryList
          items={items}
          currentQueryId={currentQueryId}
          onSelect={onSelect}
        />
      </aside>
    </>
  )
}

function HistoryList({
  items,
  currentQueryId,
  onSelect,
}: HistorySidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          History
        </p>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-xs leading-relaxed text-fg-ghost">
          No queries yet. Ask the council a question to get started.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface ${
                  item.id === currentQueryId ? "bg-surface" : ""
                }`}
              >
                <p className="line-clamp-2 text-sm leading-snug text-foreground">
                  {item.question}
                </p>

                {item.status === "failed" && (
                  <p className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-critical">
                    <AlertTriangle className="h-3 w-3" />
                    Failed
                  </p>
                )}

                {item.recommendation && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-fg-muted">
                    {item.recommendation}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                  <span>{relativeTime(item.completed_at ?? item.created_at)}</span>
                  {item.total_cost_usd !== null && (
                    <span>${item.total_cost_usd.toFixed(3)}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}
