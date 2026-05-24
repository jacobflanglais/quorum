"use client"

import { ExternalLink, Globe } from "lucide-react"
import type { SearchResult } from "@/lib/search/tavily"

interface SourcesPanelProps {
  sources: SearchResult[]
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  if (!sources || sources.length === 0) return null

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="h-4 w-4 text-fg-muted" />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-ghost">
          Sources · {sources.length}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {sources.map((src) => (
          <li key={src.citation_index}>
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:border-accent-muted/40 hover:bg-accent-subtle/50"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border bg-background font-mono text-[10px] text-fg-muted">
                {src.citation_index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground group-hover:text-primary">
                  {src.title}
                </span>
                <span className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                  {extractDomain(src.url)}
                  {src.published_date && (
                    <>
                      <span>·</span>
                      <span>{formatDate(src.published_date)}</span>
                    </>
                  )}
                </span>
              </span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-fg-ghost transition-colors group-hover:text-primary" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return s
  }
}
