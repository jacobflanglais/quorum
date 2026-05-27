"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { QueryForm } from "./QueryForm"
import { SynthesisDisplay } from "./SynthesisDisplay"
import { RawResponsesPanel } from "./RawResponsesPanel"
import { SourcesPanel } from "./SourcesPanel"
import { HistorySidebar } from "./HistorySidebar"
import type { CurrentResult, HistoryItem } from "./types"
import type { CouncilResult } from "@/lib/council/types"

interface CouncilWorkspaceProps {
  initialHistory: HistoryItem[]
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting"; question: string }
  | { kind: "loading_history"; id: string }
  | { kind: "result"; result: CurrentResult }
  | { kind: "error"; message: string }

export function CouncilWorkspace({ initialHistory }: CouncilWorkspaceProps) {
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/council/history", { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as { items: HistoryItem[] }
      setHistory(json.items ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  const submitQuestion = useCallback(
    async (input: {
      question: string
      searchEnabled: boolean
      deepResearch: boolean
    }) => {
      const { question, searchEnabled, deepResearch } = input
      setPhase({ kind: "submitting", question })
      try {
        // IANA timezone so the server can render "today" / "tonight"
        // in the user's local frame instead of UTC.
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const res = await fetch("/api/council", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question,
            searchEnabled,
            deepResearch,
            userTimeZone,
          }),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          setPhase({
            kind: "error",
            message: errBody.error ?? `Request failed (${res.status})`,
          })
          return
        }
        const json = (await res.json()) as CouncilResult
        setPhase({ kind: "result", result: toCurrentResult(json) })
        await refreshHistory()
      } catch (err) {
        setPhase({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Network error during convene.",
        })
      }
    },
    [refreshHistory],
  )

  const loadHistoryItem = useCallback(async (id: string) => {
    setPhase({ kind: "loading_history", id })
    try {
      const res = await fetch(`/api/council/${id}`, { cache: "no-store" })
      if (!res.ok) {
        setPhase({ kind: "error", message: "Could not load that query." })
        return
      }
      const json = await res.json()
      setPhase({ kind: "result", result: historyToCurrentResult(json) })
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error.",
      })
    }
  }, [])

  // refresh history periodically when idle (catches background completions)
  useEffect(() => {
    const id = setInterval(() => {
      if (phase.kind === "idle" || phase.kind === "result") refreshHistory()
    }, 60_000)
    return () => clearInterval(id)
  }, [phase.kind, refreshHistory])

  const currentQueryId =
    phase.kind === "result" ? phase.result.query_id : null

  return (
    <div className="flex flex-1">
      <HistorySidebar
        items={history}
        currentQueryId={currentQueryId}
        onSelect={loadHistoryItem}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-12">
          <QueryForm
            pending={phase.kind === "submitting"}
            onSubmit={submitQuestion}
          />

          <div className="mt-12">
            <WorkspaceBody phase={phase} />
          </div>
        </div>
      </main>
    </div>
  )
}

function WorkspaceBody({ phase }: { phase: Phase }) {
  if (phase.kind === "idle") {
    return <EmptyState />
  }
  if (phase.kind === "submitting") {
    return <LoadingState question={phase.question} />
  }
  if (phase.kind === "loading_history") {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-mono text-[11px] uppercase tracking-widest">
          Loading
        </span>
      </div>
    )
  }
  if (phase.kind === "error") {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/5 p-6 text-sm text-foreground">
        <p className="font-mono text-[10px] uppercase tracking-widest text-critical">
          Error
        </p>
        <p className="mt-2 leading-relaxed">{phase.message}</p>
      </div>
    )
  }

  const { result } = phase
  return (
    <div>
      <p className="mb-8 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        Question
      </p>
      <p className="mb-12 font-display text-2xl leading-snug tracking-tight text-foreground">
        {result.question}
      </p>

      {result.search_error && (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
          <p className="font-mono text-[10px] uppercase tracking-widest text-warning">
            Web search unavailable
          </p>
          <p className="mt-2 leading-relaxed text-fg-muted">
            Search was requested but couldn&rsquo;t complete:{" "}
            <code className="font-mono text-xs">{result.search_error}</code>. The
            council answered using model knowledge only — answers may be
            outdated or ungrounded.
          </p>
        </div>
      )}

      {result.synthesis ? (
        <SynthesisDisplay synthesis={result.synthesis.json} />
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-6 text-sm text-foreground">
          <p className="font-mono text-[10px] uppercase tracking-widest text-warning">
            No synthesis
          </p>
          <p className="mt-2 leading-relaxed">
            Fewer than two voices returned a usable answer, so synthesis was
            skipped. Check the raw responses below for details.
          </p>
        </div>
      )}

      {result.search_results && result.search_results.length > 0 && (
        <SourcesPanel sources={result.search_results} />
      )}

      <RawResponsesPanel voices={result.voices} />

      <div className="mt-10 flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
        <span>
          {result.voices.filter((v) => v.ok).length}/{result.voices.length} voices
          ·{" "}
          {result.synthesis?.cost_usd !== undefined &&
          result.synthesis?.cost_usd !== null
            ? `synth $${result.synthesis.cost_usd.toFixed(4)}`
            : "synth —"}
        </span>
        <span>
          {(result.total_latency_ms / 1000).toFixed(1)}s · $
          {result.total_cost_usd.toFixed(4)}
        </span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-10 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
        Ready
      </p>
      <p className="mt-4 font-display text-xl text-foreground">
        Ask the council your first question.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">
        The same prompt fans out to Claude, GPT, and Gemini in parallel. Opus
        synthesizes their answers — without knowing whose is whose.
      </p>
    </div>
  )
}

function LoadingState({ question }: { question: string }) {
  return (
    <div className="rounded-lg border border-accent-muted/30 bg-accent-subtle p-8">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
          Convening
        </p>
      </div>
      <p className="mt-4 font-display text-lg leading-snug text-foreground">
        {question}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        Querying three frontier models in parallel. This typically takes
        10–30 seconds.
      </p>
    </div>
  )
}

// ── transformers ────────────────────────────────────────────

function toCurrentResult(json: CouncilResult): CurrentResult {
  return {
    query_id: json.query_id,
    question: json.question,
    voices: json.voices.map((v) =>
      v.ok
        ? {
            provider: v.provider,
            model: v.model,
            anonymous_label:
              (json.label_mapping &&
                Object.entries(json.label_mapping).find(
                  ([, p]) => p === v.provider,
                )?.[0]) as "A" | "B" | "C",
            ok: true,
            response_json: v.response,
            error: null,
            input_tokens: v.input_tokens,
            output_tokens: v.output_tokens,
            cost_usd: v.cost_usd,
            latency_ms: v.latency_ms,
          }
        : {
            provider: v.provider,
            model: v.model,
            anonymous_label: "A",
            ok: false,
            response_json: null,
            error: v.error,
            input_tokens: null,
            output_tokens: null,
            cost_usd: null,
            latency_ms: v.latency_ms,
          },
    ),
    synthesis: json.synthesis
      ? {
          json: json.synthesis.json,
          recommendation: json.synthesis.json.recommendation.text,
          confidence: json.synthesis.json.recommendation.confidence,
          label_mapping: json.label_mapping,
          cost_usd: json.synthesis.cost_usd,
          latency_ms: json.synthesis.latency_ms,
        }
      : null,
    search_results: json.search_results ?? null,
    search_error: json.search_error ?? null,
    total_cost_usd: json.total_cost_usd,
    total_latency_ms: json.total_latency_ms,
  }
}

interface HistoryDetailResponse {
  query: {
    id: string
    question: string
    search_results?: import("@/lib/search/tavily").SearchResult[] | null
  }
  voices: CurrentResult["voices"]
  synthesis: {
    json: import("@/lib/council/types").SynthesisJson
    recommendation: string | null
    confidence: "high" | "medium" | "low" | null
    label_mapping: import("@/lib/council/types").LabelMapping
    cost_usd: number | null
    latency_ms: number | null
  } | null
}

function historyToCurrentResult(json: HistoryDetailResponse): CurrentResult {
  const total_cost_usd =
    json.voices.reduce((sum, v) => sum + (v.cost_usd ?? 0), 0) +
    (json.synthesis?.cost_usd ?? 0)
  return {
    query_id: json.query.id,
    question: json.query.question,
    voices: json.voices,
    synthesis: json.synthesis,
    search_results: json.query.search_results ?? null,
    search_error: null,
    total_cost_usd,
    total_latency_ms: json.synthesis?.latency_ms ?? 0,
  }
}
