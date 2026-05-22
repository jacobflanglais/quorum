-- ─────────────────────────────────────────────────────────────
-- Quorum — Initial Schema
-- Phase 1b: profiles, model registry, council queries, voice
-- responses, syntheses. RLS enabled on every public table.
-- ─────────────────────────────────────────────────────────────

-- ── utility: updated_at trigger function ─────────────────────
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles: 1:1 with auth.users ────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── model_registry: current model per provider ───────────────
-- Single row per provider. Phase 1b: manually managed via /settings.
-- Phase 3+: weekly discovery cron writes here.
create table public.model_registry (
  provider text primary key check (provider in ('anthropic', 'openai', 'google')),
  current_model text not null,
  fallback_model text,
  pin_to_latest boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.model_registry enable row level security;

create policy "model_registry_authenticated_read" on public.model_registry
  for select to authenticated using (true);

create policy "model_registry_authenticated_update" on public.model_registry
  for update to authenticated using (true) with check (true);

create trigger model_registry_updated_at
  before update on public.model_registry
  for each row execute function public.update_updated_at();

insert into public.model_registry (provider, current_model, fallback_model) values
  ('anthropic', 'claude-opus-4-7',          'claude-sonnet-4-6'),
  ('openai',    'gpt-5.5',                  'gpt-5.1'),
  ('google',    'gemini-3.1-pro-thinking',  'gemini-2.5-pro');

-- ── known_models: every model we've ever seen ────────────────
-- Populated by the future discovery cron (Phase 3+). Used to
-- detect new releases independent of naming conventions.
create table public.known_models (
  provider text not null,
  model_id text not null,
  first_seen_at timestamptz not null default now(),
  metadata jsonb,
  primary key (provider, model_id)
);

alter table public.known_models enable row level security;

create policy "known_models_authenticated_read" on public.known_models
  for select to authenticated using (true);

-- ── council_queries: one per user-submitted question ─────────
create table public.council_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  question text not null check (char_length(question) >= 1),
  context_query_ids uuid[],
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  total_cost_usd numeric(10, 6),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index council_queries_user_created_idx
  on public.council_queries (user_id, created_at desc);

alter table public.council_queries enable row level security;

create policy "council_queries_own" on public.council_queries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── voice_responses: one row per provider per query ──────────
create table public.voice_responses (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.council_queries on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  model text not null,
  anonymous_label text not null check (anonymous_label in ('A', 'B', 'C')),
  ok boolean not null,
  response_json jsonb,
  raw_response text,
  error text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  latency_ms int,
  created_at timestamptz not null default now()
);

create index voice_responses_query_idx on public.voice_responses (query_id);

alter table public.voice_responses enable row level security;

create policy "voice_responses_via_query" on public.voice_responses
  for all to authenticated
  using (
    exists (
      select 1 from public.council_queries
      where id = voice_responses.query_id
        and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.council_queries
      where id = voice_responses.query_id
        and user_id = auth.uid()
    )
  );

-- ── syntheses: one per query (1:1) ───────────────────────────
create table public.syntheses (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null unique references public.council_queries on delete cascade,
  synthesis_markdown text not null,
  synthesis_json jsonb,
  recommendation text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  label_mapping jsonb not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  latency_ms int,
  created_at timestamptz not null default now()
);

alter table public.syntheses enable row level security;

create policy "syntheses_via_query" on public.syntheses
  for all to authenticated
  using (
    exists (
      select 1 from public.council_queries
      where id = syntheses.query_id
        and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.council_queries
      where id = syntheses.query_id
        and user_id = auth.uid()
    )
  );
