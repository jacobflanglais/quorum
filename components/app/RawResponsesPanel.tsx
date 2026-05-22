"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, XCircle } from "lucide-react"
import {
  PROVIDER_COMPANY,
  PROVIDER_LABEL,
  PROVIDER_TINT,
  type ClientVoice,
} from "./types"

interface RawResponsesPanelProps {
  voices: ClientVoice[]
}

export function RawResponsesPanel({ voices }: RawResponsesPanelProps) {
  const [open, setOpen] = useState(false)

  if (voices.length === 0) return null

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {open ? "Hide raw responses" : "Show raw responses"}
      </button>

      {open && (
        <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {voices.map((voice) => (
            <RawVoiceCard
              key={`${voice.provider}-${voice.anonymous_label}`}
              voice={voice}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RawVoiceCard({ voice }: { voice: ClientVoice }) {
  const tint = PROVIDER_TINT[voice.provider]
  const company = PROVIDER_COMPANY[voice.provider]
  const family = PROVIDER_LABEL[voice.provider]

  return (
    <div
      className="bg-surface p-5"
      style={{ borderLeft: `2px solid ${tint}` }}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
          {family}
        </p>
        {voice.ok ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            {voice.latency_ms !== null ? `${(voice.latency_ms / 1000).toFixed(1)}s` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-critical">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-lg leading-tight tracking-tight text-foreground">
        {voice.model}
      </p>
      <p className="mt-0.5 text-xs text-fg-muted">{company}</p>

      <div className="mt-5 border-t border-border pt-4">
        {voice.ok && voice.response_json ? (
          <VoiceBody voice={voice} />
        ) : (
          <p className="text-xs leading-relaxed text-critical">
            {voice.error ?? "Unknown failure"}
          </p>
        )}
      </div>

      {voice.ok && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            {voice.input_tokens ?? 0}→{voice.output_tokens ?? 0} tok
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            ${voice.cost_usd?.toFixed(4) ?? "0.0000"}
          </span>
        </div>
      )}
    </div>
  )
}

function VoiceBody({ voice }: { voice: ClientVoice }) {
  if (!voice.response_json) return null
  const { answer, key_reasoning, confidence, assumptions, risks } =
    voice.response_json
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-foreground">{answer}</p>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
          Key reasoning
        </p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          {key_reasoning}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
          Confidence
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      {assumptions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            Assumptions
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-fg-muted">
            {assumptions.map((a, i) => (
              <li key={i}>· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {risks.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg-ghost">
            Risks
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-fg-muted">
            {risks.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
