-- ─────────────────────────────────────────────────────────────
-- Phase 6: web search grounding.
-- - council_queries.search_results: persist the Tavily search
--   results used for the query (for audit + re-display when the
--   user opens an old query from history)
-- - scheduled_tasks.search_enabled: per-task toggle (defaults
--   false so existing tasks keep their current behavior)
-- ─────────────────────────────────────────────────────────────

alter table public.council_queries
  add column search_results jsonb;

alter table public.scheduled_tasks
  add column search_enabled boolean not null default false;
