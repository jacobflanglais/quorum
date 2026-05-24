/**
 * Tavily search wrapper.
 *
 * https://docs.tavily.com/docs/rest-api/api-reference
 *
 * Free tier: 1000 requests/month. Each request returns up to N results
 * with title, URL, extracted content, score, and (when available)
 * published_date. We persist these alongside the council query so the
 * UI can re-render citations later from history.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search"
const DEFAULT_MAX_RESULTS = 5
const DEFAULT_TIMEOUT_MS = 15_000

export interface SearchResult {
  /** 1-indexed in the order they were returned. Stable for citations [1], [2], … */
  citation_index: number
  title: string
  url: string
  content: string
  published_date: string | null
  score: number
}

export interface SearchInput {
  query: string
  max_results?: number
  /** "basic" (faster, cheaper) or "advanced" (deeper extraction). Default basic. */
  depth?: "basic" | "advanced"
  /** Date range floor for sources — useful for "today's news" style queries. */
  days?: number
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  /** Tavily's own summary of the search results — we don't use this; voices generate their own. */
  answer: string | null
  /** Approximate Tavily cost in USD for this call ($0.005 per basic, $0.01 per advanced). */
  cost_usd: number
  latency_ms: number
}

/**
 * Run a single Tavily search. Throws on auth/network errors. Empty
 * result arrays are returned as `results: []` (no throw).
 */
export async function tavilySearch(input: SearchInput): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set")
  }

  const start = Date.now()
  const depth = input.depth ?? "basic"
  const max_results = input.max_results ?? DEFAULT_MAX_RESULTS

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: input.query,
        search_depth: depth,
        max_results,
        include_answer: false,
        include_raw_content: false,
        days: input.days,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Tavily HTTP ${res.status}: ${body.slice(0, 300)}`)
    }

    const json = (await res.json()) as {
      query: string
      results?: Array<{
        title: string
        url: string
        content: string
        score: number
        published_date?: string
      }>
      answer?: string
    }

    const results: SearchResult[] = (json.results ?? []).map((r, idx) => ({
      citation_index: idx + 1,
      title: r.title,
      url: r.url,
      content: r.content,
      published_date: r.published_date ?? null,
      score: r.score,
    }))

    return {
      query: json.query ?? input.query,
      results,
      answer: json.answer ?? null,
      cost_usd: depth === "advanced" ? 0.01 : 0.005,
      latency_ms: Date.now() - start,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Format search results as a `<sources>` XML block to inject into a
 * voice or synthesizer prompt. Stable formatting so models learn the
 * pattern (citation indices match what users will see in the UI).
 */
export function formatSourcesForPrompt(results: SearchResult[]): string {
  if (results.length === 0) return ""

  const blocks = results.map((r) => {
    const date = r.published_date ? ` published="${r.published_date}"` : ""
    return `<source index="${r.citation_index}" url="${escapeAttr(r.url)}"${date}>
<title>${escapeXml(r.title)}</title>
<content>${escapeXml(r.content)}</content>
</source>`
  })

  return `<sources>
${blocks.join("\n\n")}
</sources>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeAttr(s: string): string {
  return escapeXml(s).replace(/"/g, "&quot;")
}
