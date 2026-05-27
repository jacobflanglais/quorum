-- ─────────────────────────────────────────────────────────────
-- Phase 6.5: per-task deep research flag.
-- Pairs with the existing search_enabled boolean — when both are
-- true, the orchestrator runs Tavily extract on top URLs after
-- search to get full page content instead of snippets.
-- ─────────────────────────────────────────────────────────────

alter table public.scheduled_tasks
  add column deep_research_enabled boolean not null default false;
