-- ─────────────────────────────────────────────────────────────
-- Scheduled tasks: generic recurring council queries.
-- A task wraps a fixed prompt + cron schedule. The cron endpoint
-- picks up due tasks, invokes the orchestrator, and links the
-- resulting council_queries row via scheduled_task_runs.
--
-- Briefings (Phase 5) are scheduled_tasks with topic tags.
-- ─────────────────────────────────────────────────────────────

create table public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  prompt text not null check (char_length(prompt) >= 1),
  schedule_cron text not null,
  timezone text not null default 'UTC',
  tags text[] not null default array[]::text[],
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cron endpoint scans by next_run_at among enabled tasks
create index scheduled_tasks_due_idx
  on public.scheduled_tasks (next_run_at)
  where enabled = true;

create index scheduled_tasks_user_created_idx
  on public.scheduled_tasks (user_id, created_at desc);

create trigger scheduled_tasks_updated_at
  before update on public.scheduled_tasks
  for each row execute function public.update_updated_at();

alter table public.scheduled_tasks enable row level security;

create policy "scheduled_tasks_own" on public.scheduled_tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- scheduled_task_runs: one row per execution of a scheduled task
-- ─────────────────────────────────────────────────────────────

create table public.scheduled_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.scheduled_tasks on delete cascade,
  council_query_id uuid references public.council_queries on delete set null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  ran_at timestamptz not null default now(),
  error text
);

create index task_runs_task_ran_idx
  on public.scheduled_task_runs (task_id, ran_at desc);

alter table public.scheduled_task_runs enable row level security;

create policy "scheduled_task_runs_via_task" on public.scheduled_task_runs
  for all to authenticated
  using (
    exists (
      select 1 from public.scheduled_tasks
      where id = scheduled_task_runs.task_id
        and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.scheduled_tasks
      where id = scheduled_task_runs.task_id
        and user_id = auth.uid()
    )
  );
