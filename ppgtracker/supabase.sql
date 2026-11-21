-- Replace OWNER_EMAIL_HERE in this local copy before running this example.
-- The deployed database's policies need no change to remove the address from GitHub.
create table if not exists public.tracker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

create policy "owner can read tracker"
on public.tracker_state for select to authenticated
using (auth.uid() = user_id and auth.jwt() ->> 'email' = 'OWNER_EMAIL_HERE');

create policy "owner can create tracker"
on public.tracker_state for insert to authenticated
with check (auth.uid() = user_id and auth.jwt() ->> 'email' = 'OWNER_EMAIL_HERE');

create policy "owner can update tracker"
on public.tracker_state for update to authenticated
using (auth.uid() = user_id and auth.jwt() ->> 'email' = 'OWNER_EMAIL_HERE')
with check (auth.uid() = user_id and auth.jwt() ->> 'email' = 'OWNER_EMAIL_HERE');
