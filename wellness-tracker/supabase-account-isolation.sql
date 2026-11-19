-- Review in your own Supabase project, then run in SQL Editor.
-- This file has NOT been run against any hosted database.
begin;
create table if not exists public.wellness_tracker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.wellness_tracker_state enable row level security;
revoke all on public.wellness_tracker_state from anon, public;
grant select, insert, update, delete on public.wellness_tracker_state to authenticated;
drop policy if exists wellness_v6_own_rows_allow on public.wellness_tracker_state;
create policy wellness_v6_own_rows_allow on public.wellness_tracker_state
  as permissive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- A restrictive policy also constrains any pre-existing permissive policies.
drop policy if exists wellness_v6_own_rows_limit on public.wellness_tracker_state;
create policy wellness_v6_own_rows_limit on public.wellness_tracker_state
  as restrictive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
