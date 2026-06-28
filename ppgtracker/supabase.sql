create table if not exists public.tracker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

create policy "owner can read tracker"
on public.tracker_state for select to authenticated
using (auth.uid() = user_id and auth.jwt() ->> 'email' = 'koffee1024@outlook.com');

create policy "owner can create tracker"
on public.tracker_state for insert to authenticated
with check (auth.uid() = user_id and auth.jwt() ->> 'email' = 'koffee1024@outlook.com');

create policy "owner can update tracker"
on public.tracker_state for update to authenticated
using (auth.uid() = user_id and auth.jwt() ->> 'email' = 'koffee1024@outlook.com')
with check (auth.uid() = user_id and auth.jwt() ->> 'email' = 'koffee1024@outlook.com');
