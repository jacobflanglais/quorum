import type { SynthesisJson } from "./types"

/**
 * Render the synthesizer's structured JSON to clean markdown.
 *
 * Used for export/preview/audit. The UI itself renders sections
 * from the JSON directly so it can style each section richly —
 * this markdown is the long-form fallback.
 */
export function renderSynthesisMarkdown(s: SynthesisJson): string {
  const lines: string[] = []

  lines.push("## E. Recommendation", "")
  lines.push(`**${s.recommendation.text}**`, "")
  lines.push(s.recommendation.why, "")
  lines.push(`_Main caveat:_ ${s.recommendation.main_caveat}`, "")
  lines.push(`_Confidence:_ ${s.recommendation.confidence}`, "")
  lines.push("---", "")

  lines.push("## A. Individual Positions", "")
  for (const pos of s.individual_positions) {
    lines.push(`**Model ${pos.label}** (${pos.confidence_posture})`)
    lines.push(pos.core_claim)
    lines.push(`_Reasoning:_ ${pos.key_reasoning}`, "")
  }

  if (s.agreement_map.length > 0) {
    lines.push("## B. Agreement Map", "")
    for (const item of s.agreement_map) {
      lines.push(`- **${labelConsensus(item.type)}** — ${item.claim}`)
      if (item.notes) lines.push(`  ${item.notes}`)
    }
    lines.push("")
  }

  if (s.divergence_analysis.length > 0) {
    lines.push("## C. Divergence Analysis", "")
    for (const div of s.divergence_analysis) {
      lines.push(
        `- **${div.topic}** (${labelWeight(div.weight)} · ${labelRootCause(div.root_cause)})`,
      )
      lines.push(`  ${div.summary}`)
    }
    lines.push("")
  }

  if (s.blind_spots.length > 0) {
    lines.push("## D. Blind Spots", "")
    for (const spot of s.blind_spots) {
      lines.push(`- ${spot}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function labelConsensus(type: SynthesisJson["agreement_map"][number]["type"]) {
  switch (type) {
    case "strong":
      return "Strong consensus"
    case "majority":
      return "Majority consensus"
    case "surface":
      return "Surface consensus (watch out)"
  }
}

function labelWeight(
  weight: SynthesisJson["divergence_analysis"][number]["weight"],
) {
  switch (weight) {
    case "high":
      return "high impact"
    case "medium":
      return "medium impact"
    case "low":
      return "low impact"
  }
}

function labelRootCause(
  rc: SynthesisJson["divergence_analysis"][number]["root_cause"],
) {
  switch (rc) {
    case "factual":
      return "factual dispute"
    case "framing":
      return "framing difference"
    case "assumption":
      return "assumption gap"
    case "confidence":
      return "confidence calibration"
    case "genuine_uncertainty":
      return "genuine uncertainty"
  }
}
