/**
 * Tavily search + extract wrapper.
 *
 * https://docs.tavily.com/docs/rest-api/api-reference
 *
 * Two endpoints:
 *  - /search: returns title, URL, snippet/extracted-text, score per result
 *  - /extract: takes URLs, returns the full extracted page content
 *
 * Quorum uses search by default. When Deep Research mode is enabled,
 * the orchestrator also calls extract on the top N URLs and replaces
 * the snippet content with the full page text so voices reason over
 * the real article instead of just a meta description.
 */

const TAVILY_SEARCH = "https://api.tavily.com/search"
const TAVILY_EXTRACT = "https://api.tavily.com/extract"
const DEFAULT_MAX_RESULTS = 5
const DEFAULT_SEARCH_TIMEOUT_MS = 20_000
const DEFAULT_EXTRACT_TIMEOUT_MS = 45_000
/** How many of the top search URLs to fully extract in deep mode. */
const DEEP_EXTRACT_TOP_N = 4

export interface SearchResult {
  /** 1-indexed in the order they were returned. Stable for citations [1], [2], … */
  citation_index: number
  title: string
  url: string
  content: string
  published_date: string | null
  score: number
  /** True when this result's content was replaced by full-page extraction. */
  extracted: boolean
}

export interface SearchInput {
  query: string
  max_results?: number
  /** "basic" (faster, cheaper) or "advanced" (deeper extraction). Default advanced. */
  depth?: "basic" | "advanced"
  /** Date range floor for sources — useful for "today's news" style queries. */
  days?: number
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  cost_usd: number
  latency_ms: number
}

/**
 * Run a single Tavily search. Defaults to advanced depth + raw content
 * so voices get ~10x more usable text per source than basic snippets.
 */
export async function tavilySearch(input: SearchInput): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set")
  }

  const start = Date.now()
  const depth = input.depth ?? "advanced"
  const max_results = input.max_results ?? DEFAULT_MAX_RESULTS

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SEARCH_TIMEOUT_MS)

  try {
    const res = await fetch(TAVILY_SEARCH, {
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
        include_raw_content: true, // ← ~10x more text per source
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
        raw_content?: string | null
        score: number
        published_date?: string
      }>
    }

    const results: SearchResult[] = (json.results ?? []).map((r, idx) => ({
      citation_index: idx + 1,
      title: r.title,
      url: r.url,
      content: r.raw_content?.trim() ? r.raw_content : r.content,
      published_date: r.published_date ?? null,
      score: r.score,
      extracted: false,
    }))

    return {
      query: json.query ?? input.query,
      results,
      cost_usd: depth === "advanced" ? 0.01 : 0.005,
      latency_ms: Date.now() - start,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Deep extraction — fetch the FULL extracted content of given URLs.
 * Used after a search to replace snippet-only sources with real page
 * text. Tavily charges $0.005 per URL extracted.
 */
export async function tavilyExtract(
  urls: string[],
): Promise<{ contents: Record<string, string>; cost_usd: number; latency_ms: number }> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set")
  }
  if (urls.length === 0) {
    return { contents: {}, cost_usd: 0, latency_ms: 0 }
  }

  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_EXTRACT_TIMEOUT_MS)

  try {
    const res = await fetch(TAVILY_EXTRACT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls,
        extract_depth: "advanced",
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Tavily extract HTTP ${res.status}: ${body.slice(0, 300)}`)
    }

    const json = (await res.json()) as {
      results?: Array<{ url: string; raw_content?: string }>
    }

    const contents: Record<string, string> = {}
    for (const r of json.results ?? []) {
      if (r.raw_content) contents[r.url] = r.raw_content
    }

    return {
      contents,
      cost_usd: urls.length * 0.005,
      latency_ms: Date.now() - start,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Convenience wrapper: search, then (if deep) extract top URLs and
 * merge the full content back into the results. Returns the same
 * SearchResult[] shape with `extracted: true` on enriched results.
 */
export async function tavilySearchAndMaybeExtract(input: {
  query: string
  deep: boolean
  topN?: number
}): Promise<SearchResponse> {
  const search = await tavilySearch({ query: input.query })

  if (!input.deep || search.results.length === 0) {
    return search
  }

  const topN = input.topN ?? DEEP_EXTRACT_TOP_N
  const targets = search.results.slice(0, topN).map((r) => r.url)

  try {
    const ex = await tavilyExtract(targets)
    const enriched = search.results.map((r) => {
      const full = ex.contents[r.url]
      if (!full) return r
      return { ...r, content: full, extracted: true }
    })
    return {
      ...search,
      results: enriched,
      cost_usd: search.cost_usd + ex.cost_usd,
      latency_ms: search.latency_ms + ex.latency_ms,
    }
  } catch (err) {
    // Extract failed — return original snippets, log and proceed
    console.error(
      "[tavily] extract failed (falling back to snippets):",
      err instanceof Error ? err.message : err,
    )
    return search
  }
}

/**
 * Format search results as a `<sources>` XML block to inject into a
 * voice or synthesizer prompt. Content is truncated per-source to
 * keep total prompt size reasonable even with full-page extraction.
 */
export function formatSourcesForPrompt(results: SearchResult[]): string {
  if (results.length === 0) return ""

  const MAX_CONTENT_CHARS_PER_SOURCE = 4000

  const blocks = results.map((r) => {
    const date = r.published_date ? ` published="${r.published_date}"` : ""
    const tag = r.extracted ? ` extracted="true"` : ""
    const content =
      r.content.length > MAX_CONTENT_CHARS_PER_SOURCE
        ? r.content.slice(0, MAX_CONTENT_CHARS_PER_SOURCE) + "\n[truncated]"
        : r.content
    return `<source index="${r.citation_index}" url="${escapeAttr(r.url)}"${date}${tag}>
<title>${escapeXml(r.title)}</title>
<content>${escapeXml(content)}</content>
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
