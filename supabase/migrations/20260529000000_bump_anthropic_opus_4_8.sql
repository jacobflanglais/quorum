-- ── Bump Anthropic voice model: Opus 4.7 → 4.8 ──────────────
-- Opus 4.8 shipped 2026-05-28. Anthropic model IDs are pinned
-- snapshots (the API never auto-upgrades across versions), so the
-- registry must be updated explicitly.
--
-- This runs as a FORWARD migration rather than editing the original
-- seed: every environment — including ones that already ran the
-- initial schema — applies it exactly once. The WHERE guard makes it
-- a no-op anywhere the value isn't the known prior default, so a
-- hand-picked override (or a freshly-seeded 4.8 row) is never clobbered.
update public.model_registry
set current_model = 'claude-opus-4-8'
where provider = 'anthropic' and current_model = 'claude-opus-4-7';

-- Activate auto-discovery for Anthropic going forward. With this set,
-- the weekly /api/cron/model-discovery job adopts the newest model in
-- the same family (opus) as it ships — no further hand edits needed.
-- Guarded to the row we just bumped (or a freshly-seeded 4.8 row), so a
-- deliberate operator override to some other model is never auto-pinned.
update public.model_registry
set pin_to_latest = true
where provider = 'anthropic' and current_model = 'claude-opus-4-8';
