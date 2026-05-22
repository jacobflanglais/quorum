-- ─────────────────────────────────────────────────────────────
-- Advisor remediation
-- 1) Drop the permissive UPDATE policy on model_registry.
--    Updates will route through server-side API using SECRET_KEY
--    (which bypasses RLS). Browser-side writes are blocked.
-- 2) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
--    from public/anon/authenticated so they aren't callable as
--    REST RPCs. Triggers continue to fire (they execute as owner).
-- ─────────────────────────────────────────────────────────────

drop policy if exists "model_registry_authenticated_update" on public.model_registry;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_updated_at() from public, anon, authenticated;
