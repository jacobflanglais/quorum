"use client"

import { useState } from "react"
import { Check, Edit3, Loader2, X } from "lucide-react"
import type { RegistryEntry } from "@/lib/council/registry"
import type { AppConfig } from "@/lib/council/config"
import type { Provider } from "@/lib/council/types"
import { PushSubscription } from "@/components/app/PushSubscription"

interface CostStats {
  today_usd: number
  month_usd: number
  queries_today: number
  queries_month: number
  monthly_budget_usd: number
}

interface SettingsClientProps {
  initialRegistry: RegistryEntry[]
  initialAppConfig: AppConfig
  initialCostStats: CostStats
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
}

const PROVIDER_TINT: Record<Provider, string> = {
  anthropic: "var(--color-tint-anthropic)",
  openai: "var(--color-tint-openai)",
  google: "var(--color-tint-google)",
}

export function SettingsClient({
  initialRegistry,
  initialAppConfig,
  initialCostStats,
}: SettingsClientProps) {
  const [registry, setRegistry] = useState(initialRegistry)
  const [appConfig, setAppConfig] = useState(initialAppConfig)
  const [costStats] = useState(initialCostStats)

  return (
    <div className="flex flex-col gap-16">
      <CostSection stats={costStats} />
      <NotificationsSection />
      <VoicesSection
        registry={registry}
        onUpdate={(provider, updates) =>
          setRegistry((r) =>
            r.map((entry) =>
              entry.provider === provider ? { ...entry, ...updates } : entry,
            ),
          )
        }
      />
      <SynthesizerSection
        appConfig={appConfig}
        onUpdate={(next) => setAppConfig(next)}
      />
    </div>
  )
}

// ── Notifications ───────────────────────────────────────────

function NotificationsSection() {
  return (
    <section>
      <SectionHeader label="Notifications" title="How Quorum reaches you" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-fg-muted">
        Scheduled tasks email you on completion by default (per-task toggle).
        For real-time delivery on your phone&rsquo;s lock screen, enable push
        notifications here.{" "}
        <span className="text-fg-ghost">
          On iOS this requires installing Quorum to the home screen first.
        </span>
      </p>
      <PushSubscription />
    </section>
  )
}

// ── Cost ────────────────────────────────────────────────────

function CostSection({ stats }: { stats: CostStats }) {
  const monthPct =
    stats.monthly_budget_usd > 0
      ? Math.min(100, (stats.month_usd / stats.monthly_budget_usd) * 100)
      : 0

  return (
    <section>
      <SectionHeader label="Spend" title="What you've used" />
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <StatCard
          label="Today"
          value={`$${stats.today_usd.toFixed(4)}`}
          sub={`${stats.queries_today} ${stats.queries_today === 1 ? "query" : "queries"}`}
        />
        <StatCard
          label="This month"
          value={`$${stats.month_usd.toFixed(2)}`}
          sub={`${stats.queries_month} ${stats.queries_month === 1 ? "query" : "queries"} · budget $${stats.monthly_budget_usd}`}
        />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${monthPct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
        {monthPct.toFixed(1)}% of monthly budget used
      </p>
    </section>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-fg-muted">{sub}</p>
    </div>
  )
}

// ── Voices ──────────────────────────────────────────────────

function VoicesSection({
  registry,
  onUpdate,
}: {
  registry: RegistryEntry[]
  onUpdate: (provider: Provider, updates: Partial<RegistryEntry>) => void
}) {
  return (
    <section>
      <SectionHeader label="Voices" title="Who's on the council" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-fg-muted">
        One model per provider. Changing a voice takes effect on your next
        query — the model registry is read fresh each time.
      </p>
      <div className="flex flex-col gap-3">
        {registry.map((entry) => (
          <VoiceRow
            key={entry.provider}
            entry={entry}
            onUpdate={(updates) => onUpdate(entry.provider, updates)}
          />
        ))}
      </div>
    </section>
  )
}

function VoiceRow({
  entry,
  onUpdate,
}: {
  entry: RegistryEntry
  onUpdate: (updates: Partial<RegistryEntry>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [model, setModel] = useState(entry.current_model)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!model.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/voices/${entry.provider}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current_model: model.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      onUpdate({ current_model: model.trim() })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-border bg-surface p-5"
      style={{ borderLeft: `2px solid ${PROVIDER_TINT[entry.provider]}` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            {PROVIDER_LABEL[entry.provider]}
          </p>
          {editing ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={saving}
                placeholder={entry.current_model}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !model.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-accent-subtle px-3 font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setModel(entry.current_model)
                    setError(null)
                  }}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 font-display text-xl tracking-tight text-foreground">
              {entry.current_model}
            </p>
          )}
          {entry.fallback_model && !editing && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
              Fallback · {entry.fallback_model}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-2 text-xs leading-relaxed text-critical"
            >
              {error}
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ── Synthesizer ─────────────────────────────────────────────

function SynthesizerSection({
  appConfig,
  onUpdate,
}: {
  appConfig: AppConfig
  onUpdate: (next: AppConfig) => void
}) {
  const [editing, setEditing] = useState(false)
  const [model, setModel] = useState(appConfig.synthesizer_model)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!model.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings/synthesizer", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ synthesizer_model: model.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { appConfig: AppConfig }
      onUpdate(data.appConfig)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <SectionHeader label="Synthesizer" title="Who reads the room" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-fg-muted">
        The synthesizer reads the three anonymized voices and produces the
        A→E synthesis. It sits <em>outside</em> the voice pool so no model is
        judging its own answer — strictly stronger bias mitigation than
        anonymization alone. Default is{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
          claude-sonnet-4-6
        </code>{" "}
        — strong at structured synthesis, ~5× cheaper than Opus.
      </p>

      <div className="rounded-lg border border-accent-muted/30 bg-accent-subtle p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
              Current
            </p>
            {editing ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={saving}
                  placeholder={appConfig.synthesizer_model}
                  className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !model.trim()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 bg-background px-3 font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setModel(appConfig.synthesizer_model)
                      setError(null)
                    }}
                    disabled={saving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 font-display text-xl tracking-tight text-foreground">
                {appConfig.synthesizer_model}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-2 text-xs leading-relaxed text-critical"
              >
                {error}
              </p>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-muted/50 px-3 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-accent-muted/20"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SuggestionPill
          model="claude-sonnet-4-6"
          note="Default · structured · ~5× cheaper than Opus"
        />
        <SuggestionPill
          model="claude-opus-4-7"
          note="Strongest reasoning · expensive · self-bias risk"
        />
        <SuggestionPill
          model="claude-haiku-4-5"
          note="Cheapest · weakest synthesis · use sparingly"
        />
      </div>
    </section>
  )
}

function SuggestionPill({ model, note }: { model: string; note: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="font-mono text-xs text-foreground">{model}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{note}</p>
    </div>
  )
}

// ── shared ──────────────────────────────────────────────────

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-ghost">
        {label}
      </p>
      <h2 className="mt-2 font-display text-2xl tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  )
}
