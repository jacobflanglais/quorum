-- ─────────────────────────────────────────────────────────────
-- Per-task notification preferences.
-- New tasks default to "notify everywhere" so the user gets
-- meaningful output by default; they can turn channels off later.
--
-- notify_push has no effect until Phase 4b lands the push pipeline.
-- ─────────────────────────────────────────────────────────────

alter table public.scheduled_tasks
  add column notify_email boolean not null default true,
  add column notify_push  boolean not null default true;
