-- ─────────────────────────────────────────────────────────────
-- app_config: generic key-value store for app-wide settings
-- distinct from model_registry which is strictly "current voice
-- model per provider". Initial use: synthesizer choice (which
-- isn't tied to a single provider role and may shift over time).
-- ─────────────────────────────────────────────────────────────

create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy "app_config_authenticated_read" on public.app_config
  for select to authenticated using (true);

-- Writes are intentionally NOT exposed to the authenticated role.
-- Settings page updates go through a server-side API that uses
-- SUPABASE_SECRET_KEY (service role), which bypasses RLS.

create trigger app_config_updated_at
  before update on public.app_config
  for each row execute function public.update_updated_at();

insert into public.app_config (key, value) values
  ('synthesizer_provider', 'anthropic'),
  ('synthesizer_model',    'claude-sonnet-4-6');
