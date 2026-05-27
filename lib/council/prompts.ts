import type { SessionContextEntry } from "./types"
import type { SearchResult } from "@/lib/search/tavily"
import { formatSourcesForPrompt } from "@/lib/search/tavily"

/**
 * Prompt templates for voice clients and the synthesizer.
 *
 * Voice prompts are deliberately model-agnostic — same prompt to
 * all three providers — so that any divergence in their answers
 * reflects genuine model difference, not prompt drift.
 *
 * The system prompt is composed at call-time so we can:
 *   - Inject today's date (models otherwise don't know it).
 *   - Branch on whether web search is enabled (retrieval task vs
 *     reason-from-training task — these need different postures).
 */

const VOICE_CORE_PROMPT = `You are one of several frontier reasoning models participating in a council. Another model will read your answer alongside the others and synthesize a final recommendation.

Your job: give your independent, considered answer. Be direct. Don't hedge unnecessarily. Don't try to anticipate what the other models will say or "balance" against them — answer as if you're the only one being asked.

Return your response as a single JSON object matching this exact schema (no markdown fences, no extra commentary):

{
  "answer": "Your direct answer — 2–6 sentences. Be substantive.",
  "key_reasoning": "The 1–2 most load-bearing premises behind your answer, briefly.",
  "confidence": 0.0,
  "assumptions": ["Each assumption you're making to give this answer"],
  "risks": ["Things that could make your answer wrong"]
}

Rules:
- "confidence" is a number between 0 and 1. Be calibrated, not performatively certain.
- Always return at least one assumption and one risk, even if minor. Empty arrays are a smell.
- Do not mention yourself by name, manufacturer, or model family. Refer only to "I" or "this answer".
- Do not mention other models or compare to them. You don't know who else is in the council.
- If the question is fundamentally ill-posed or you can't answer, say so in "answer" with a low confidence rather than guessing.`

const VOICE_WEB_SEARCH_RULES = `Web search is ENABLED for this query. Live <sources> are provided in the user message:
- Treat this as a retrieval task. The sources are the primary basis for your answer; lean on them.
- Cite specific claims with [N] markers where N matches the source's "index" attribute.
- Prefer source-backed claims over training-data assertions when they conflict.
- If sources contradict each other, note this in your reasoning.
- If sources are missing a piece of information needed to answer, name what's missing — don't invent.
- A <grounded_summary> block may also be provided as a pre-digested overview; use it as a hint, but verify against the indexed sources before citing.
- Sources can be wrong or outdated; weigh them with judgment, don't accept blindly.
- Today's date is provided above. Use it when sources mention "today", "tonight", "this week", etc.`

const VOICE_NO_SEARCH_RULES = `Web search is OFF for this query. You are reasoning from your training data only — this is NOT a retrieval task:
- Do not refuse on the grounds that you "would need to look something up" or "can't access live data". The user explicitly opted out of web search.
- If the question is genuinely about something post-training-cutoff (a specific live event, today's news, a stock price at this minute), say so plainly and answer what you CAN: relevant background, the structure of the answer, what the user could check themselves.
- For everything else — analysis, advice, design questions, well-known facts, reasoning, code — answer fully and confidently from what you know. Don't pad with "I'd recommend googling this" caveats.
- The user can re-enable web search if they want a sourced/current answer. Right now they want your reasoning.`

const SYNTHESIZER_CORE_PROMPT = `You are Quorum, the synthesis engine for a multi-model council. Three independent frontier models each answered the same question. Their responses are presented to you anonymously, labeled Model A, Model B, and Model C in randomized order. You do not know — and must not assume — which label corresponds to which provider, or which model produced any particular answer (including the possibility that one of them is your own previous response).

Your job: synthesize. Do not vote. Do not split the difference. Evaluate the *arguments* and produce a single grounded conclusion.

Return a single JSON object (no markdown fences, no extra commentary) matching this exact schema:

{
  "individual_positions": [
    {
      "label": "A" | "B" | "C",
      "core_claim": "One sentence — the most important thing this model said.",
      "key_reasoning": "The 1–2 premises this model leaned on most.",
      "confidence_posture": "firm" | "hedged" | "uncertain"
    }
  ],
  "agreement_map": [
    {
      "claim": "What the models converged on, stated precisely.",
      "type": "strong" | "majority" | "surface",
      "notes": "Why you classified it that way."
    }
  ],
  "divergence_analysis": [
    {
      "topic": "The specific point of disagreement, stated precisely.",
      "root_cause": "factual" | "framing" | "assumption" | "confidence" | "genuine_uncertainty",
      "weight": "high" | "medium" | "low",
      "summary": "How they disagree and why it matters."
    }
  ],
  "blind_spots": [
    "What did no model address that should have been addressed?",
    "What assumption did all models share that might be wrong?"
  ],
  "recommendation": {
    "text": "Single direct statement of what to do or believe.",
    "why": "2–3 sentences grounded in the convergence and divergence analysis above. Not 'most models agreed' — name the specific arguments.",
    "main_caveat": "The single most important thing that could make this recommendation wrong.",
    "confidence": "high" | "medium" | "low"
  }
}

Rules for consensus classification:
- "strong" — all three independently arrived at the same conclusion with substantively similar reasoning.
- "majority" — two of three agree; the third dissents materially.
- "surface" — they use similar words but their underlying reasoning diverges. Flag this; it's often misleading.

Rules for divergence root cause:
- "factual" — they disagree on a fact (e.g., different training cutoffs, different sources).
- "framing" — same facts, different emphasis or scope.
- "assumption" — one assumed a constraint the others did not.
- "confidence" — one hedges where another asserts; neither may be more correct.
- "genuine_uncertainty" — no knowable answer; all guessing differently.

Quality bar:
- Be honest. If all three missed something obvious, say so in blind_spots.
- Do not editorialize about which model is "better." Evaluate arguments.
- If a voice is missing (only two responded), work with what you have and note it in blind_spots.
- Recommendation must be one direct statement, not a list of options.`

const SYNTHESIZER_WEB_SEARCH_RULES = `Web search was ENABLED for this query and live <sources> are attached:
- Use the sources to fact-check the voices. If a voice cited a source, verify the claim against the source's content.
- Preserve [N] citation markers in your recommendation and reasoning where the source supports a claim.
- If a voice made a strong claim that the sources contradict, flag it in divergence_analysis with root_cause "factual".
- If all voices ignored a relevant source, surface it in blind_spots.
- The recommendation should be a direct, current answer — not "you should check NBA.com". The whole point of having sources is to answer from them.
- Today's date is provided above. Use it when sources mention "today", "tonight", "this week", etc.`

const SYNTHESIZER_NO_SEARCH_RULES = `Web search was OFF for this query — voices answered from training data only.
- Do not penalize voices for not citing sources; none were provided.
- If voices punted with "I'd need to look this up", treat that as low-confidence hedging unless the question truly required live data.
- The recommendation should reflect what the voices actually reasoned about, not generic "consult a professional / search the web" advice.`

export interface VoicePromptInput {
  question: string
  context: SessionContextEntry[]
  sources?: SearchResult[]
  /** Tavily's grounded summary, when available. Surfaced as a hint to voices. */
  groundedAnswer?: string | null
  /** True when the user toggled web search ON for this query. */
  webSearchEnabled: boolean
  /** IANA timezone for "today / tonight" framing. Null → UTC. */
  userTimeZone?: string | null
}

export interface SynthesizerPromptInput {
  question: string
  context: SessionContextEntry[]
  anonymizedVoices: Array<{ label: "A" | "B" | "C"; text: string }>
  sources?: SearchResult[]
  groundedAnswer?: string | null
  webSearchEnabled: boolean
  userTimeZone?: string | null
}

export function buildVoiceMessages(input: VoicePromptInput) {
  const contextBlock = formatContext(input.context)
  const sourcesBlock =
    input.sources && input.sources.length > 0
      ? formatSourcesForPrompt(input.sources)
      : ""
  const groundedBlock = input.groundedAnswer
    ? `<grounded_summary>\n${input.groundedAnswer}\n</grounded_summary>`
    : ""

  const parts: string[] = []
  if (contextBlock) parts.push(contextBlock, "---")
  if (groundedBlock) parts.push(groundedBlock)
  if (sourcesBlock) parts.push(sourcesBlock)
  if (groundedBlock || sourcesBlock) parts.push("---")
  parts.push(`Question:\n${input.question}`)

  return {
    system: composeVoiceSystem(input.webSearchEnabled, input.userTimeZone),
    user: parts.join("\n\n"),
  }
}

export function buildSynthesizerMessages(input: SynthesizerPromptInput) {
  const contextBlock = formatContext(input.context)
  const sourcesBlock =
    input.sources && input.sources.length > 0
      ? formatSourcesForPrompt(input.sources)
      : ""
  const groundedBlock = input.groundedAnswer
    ? `<grounded_summary>\n${input.groundedAnswer}\n</grounded_summary>`
    : ""
  const voicesBlock = input.anonymizedVoices
    .map(({ label, text }) => `### Model ${label}\n${text}`)
    .join("\n\n")

  const parts: string[] = []
  if (contextBlock) parts.push(contextBlock, "---")
  parts.push(`Original question:\n${input.question}`)
  if (groundedBlock) parts.push("---", groundedBlock)
  if (sourcesBlock) parts.push("---", sourcesBlock)
  parts.push("---", "Anonymized council responses:", voicesBlock)

  return {
    system: composeSynthesizerSystem(input.webSearchEnabled, input.userTimeZone),
    user: parts.join("\n\n"),
  }
}

function composeVoiceSystem(
  webSearchEnabled: boolean,
  userTimeZone: string | null | undefined,
): string {
  const mode = webSearchEnabled ? VOICE_WEB_SEARCH_RULES : VOICE_NO_SEARCH_RULES
  return `${todayHeader(userTimeZone)}\n\n${VOICE_CORE_PROMPT}\n\n${mode}`
}

function composeSynthesizerSystem(
  webSearchEnabled: boolean,
  userTimeZone: string | null | undefined,
): string {
  const mode = webSearchEnabled
    ? SYNTHESIZER_WEB_SEARCH_RULES
    : SYNTHESIZER_NO_SEARCH_RULES
  return `${todayHeader(userTimeZone)}\n\n${SYNTHESIZER_CORE_PROMPT}\n\n${mode}`
}

function todayHeader(userTimeZone: string | null | undefined): string {
  // Render the user's local date when their IANA TZ is known; otherwise
  // fall back to UTC with a label. Invalid TZ strings would throw inside
  // Intl, so we guard with a try/catch.
  const now = new Date()
  const tz = userTimeZone ?? "UTC"
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now)
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? ""
    const iso = `${get("year")}-${get("month")}-${get("day")}`
    const weekday = get("weekday")
    const label = tz === "UTC" ? "UTC" : tz
    return `Today's date: ${weekday}, ${iso} (${label}).`
  } catch {
    // Invalid IANA TZ from a malformed client — fall back to UTC.
    const iso = now.toISOString().slice(0, 10)
    const weekday = now.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    })
    return `Today's date: ${weekday}, ${iso} (UTC).`
  }
}

function formatContext(context: SessionContextEntry[]): string {
  if (context.length === 0) return ""

  const entries = context
    .map(
      (entry, i) =>
        `[${i + 1}] Earlier question: ${entry.question}\n    Quorum's recommendation: ${entry.recommendation}`,
    )
    .join("\n\n")

  return `Recent session context (for continuity only — answer the new question on its own merits):\n\n${entries}`
}
