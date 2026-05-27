"use client"

import { AlertCircle, ArrowDown, Lightbulb } from "lucide-react"
import type {
  ConsensusType,
  DivergenceRootCause,
  DivergenceWeight,
  SynthesisJson,
  SynthesisConfidence,
} from "@/lib/council/types"

export function SynthesisDisplay({ synthesis }: { synthesis: SynthesisJson }) {
  return (
    <article className="flex flex-col gap-12">
      <RecommendationSection rec={synthesis.recommendation} />
      {synthesis.individual_positions.length > 0 && (
        <PositionsSection positions={synthesis.individual_positions} />
      )}
      {synthesis.agreement_map.length > 0 && (
        <AgreementSection items={synthesis.agreement_map} />
      )}
      {synthesis.divergence_analysis.length > 0 && (
        <DivergenceSection items={synthesis.divergence_analysis} />
      )}
      {synthesis.blind_spots.length > 0 && (
        <BlindSpotsSection items={synthesis.blind_spots} />
      )}
    </article>
  )
}

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

function RecommendationSection({
  rec,
}: {
  rec: SynthesisJson["recommendation"]
}) {
  return (
    <section>
      <SectionHeader label="E · Recommendation" title="What to do" />
      <div className="rounded-lg border border-accent-muted/30 bg-accent-subtle p-6">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="font-display text-xl leading-snug text-foreground">
              {rec.text}
            </p>
            {rec.list_items && rec.list_items.length > 0 && (
              <ol className="mt-4 flex list-none flex-col gap-1.5 text-sm leading-relaxed text-foreground">
                {rec.list_items.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 font-mono text-[10px] text-fg-ghost"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">
              {rec.why}
            </p>
            <div className="mt-6 flex flex-col gap-2 border-t border-accent-muted/30 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-fg-muted">
                <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                  Main caveat ·{" "}
                </span>
                {rec.main_caveat}
              </p>
              <ConfidenceBadge value={rec.confidence} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ConfidenceBadge({ value }: { value: SynthesisConfidence }) {
  const styles =
    value === "high"
      ? "border-success/40 text-success"
      : value === "medium"
        ? "border-warning/40 text-warning"
        : "border-critical/40 text-critical"
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border ${styles} bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-widest`}
    >
      Confidence · {value}
    </span>
  )
}

function PositionsSection({
  positions,
}: {
  positions: SynthesisJson["individual_positions"]
}) {
  return (
    <section>
      <SectionHeader
        label="A · Individual Positions"
        title="Where each model landed"
      />
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {positions.map((p) => (
          <div key={p.label} className="bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                Model {p.label}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
                {p.confidence_posture}
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {p.core_claim}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-fg-muted">
              {p.key_reasoning}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AgreementSection({
  items,
}: {
  items: SynthesisJson["agreement_map"]
}) {
  return (
    <section>
      <SectionHeader label="B · Agreement Map" title="Where they converged" />
      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <ConsensusTypeBadge type={item.type} />
              <div className="flex-1">
                <p className="text-sm leading-relaxed text-foreground">
                  {item.claim}
                </p>
                {item.notes && (
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConsensusTypeBadge({ type }: { type: ConsensusType }) {
  const text =
    type === "strong"
      ? "Strong"
      : type === "majority"
        ? "Majority"
        : "Surface"
  const styles =
    type === "strong"
      ? "border-success/40 text-success"
      : type === "majority"
        ? "border-warning/40 text-warning"
        : "border-critical/40 text-critical"
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 rounded-md border ${styles} bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest`}
    >
      {text}
    </span>
  )
}

function DivergenceSection({
  items,
}: {
  items: SynthesisJson["divergence_analysis"]
}) {
  return (
    <section>
      <SectionHeader
        label="C · Divergence Analysis"
        title="Where they diverged"
      />
      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="flex-1 text-sm font-medium leading-snug text-foreground">
                {item.topic}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <WeightBadge weight={item.weight} />
                <RootCauseBadge cause={item.root_cause} />
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-muted">
              {item.summary}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WeightBadge({ weight }: { weight: DivergenceWeight }) {
  const styles =
    weight === "high"
      ? "border-critical/40 text-critical"
      : weight === "medium"
        ? "border-warning/40 text-warning"
        : "border-border-strong text-fg-ghost"
  return (
    <span
      className={`inline-flex rounded-md border ${styles} bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest`}
    >
      {weight} impact
    </span>
  )
}

function RootCauseBadge({ cause }: { cause: DivergenceRootCause }) {
  const label = cause.replace("_", " ")
  return (
    <span className="inline-flex rounded-md border border-border-strong bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-fg-muted">
      {label}
    </span>
  )
}

function BlindSpotsSection({ items }: { items: string[] }) {
  return (
    <section>
      <SectionHeader
        label="D · Blind Spots"
        title="What all three missed"
      />
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm leading-relaxed text-foreground">{item}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ScrollToContentHint() {
  return (
    <div className="flex justify-center pt-6">
      <ArrowDown className="h-4 w-4 animate-bounce text-fg-ghost" />
    </div>
  )
}
