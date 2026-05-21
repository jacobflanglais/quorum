# Quorum

A council of frontier models. Ask once, get a synthesized answer from Claude
Opus 4.7, GPT-5.5, and Gemini 3.1 Pro Thinking — including where they agree,
where they diverge, and what every one of them missed.

Personal-use web app. Vercel-hosted, mobile-accessible, always-on. Scheduled
queries, daily briefings, and notifications come in later phases.

---

## Stack

- **Next.js 16** (App Router, Turbopack) on **Vercel** (Fluid Compute)
- **Supabase** (Postgres + Auth)
- **Tailwind v4** + **shadcn/ui** for the design system
- **Direct provider SDKs**: `@anthropic-ai/sdk`, `openai`, `@google/genai`
- **Resend** for email digests (phase 4)
- **Web Push** via service worker (phase 4)

## Visual system

**Council Chamber** — dark-first, editorial, authoritative. Single bronze
accent on warm-tinted charcoal. Fraunces (display) + Inter (body) + Geist Mono
(labels). Documented inline in `app/globals.css`.

## Local development

```bash
cp .env.local.example .env.local
# fill in values
npm install
npm run dev
```

The app expects API keys for Anthropic, OpenAI, and Google. See
`.env.local.example` for where to get each.

## Build phases

| Phase  | Scope                                                           | Status  |
| ------ | --------------------------------------------------------------- | ------- |
| **1a** | Repo + Next.js + Tailwind + shadcn + visual system              | ✅ Done |
| **1b** | Supabase auth + middleware owner-email gate                     | Next    |
| **1c** | Council orchestrator + 3 voice clients + anonymized synthesizer |         |
| **1d** | Query API route + cost tracking                                 |         |
| **1e** | Main UI: query form + synthesis card + raw-responses toggle     |         |
| **1f** | Settings page + session history sidebar                         |         |
| **2**  | PWA install + service worker                                    |         |
| **3**  | Generic scheduled-task engine + Vercel Cron                     |         |
| **4**  | Resend email + Web Push notifications                           |         |
| **5**  | Briefings: topic tagging + searchable archive                   |         |
| **6**  | Scraping (HTTP + Vercel Sandbox for bot-hardened sites)         |         |

## License

UNLICENSED — personal project.
