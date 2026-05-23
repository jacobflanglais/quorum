-- ─────────────────────────────────────────────────────────────
-- Web Push subscriptions.
-- One row per (user, device) combination. A user can have many —
-- e.g. iPhone PWA + MacBook Chrome. Each device has its own
-- endpoint + encryption keys that the browser hands us when it
-- registers; we hand them to web-push when sending.
-- ─────────────────────────────────────────────────────────────

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
