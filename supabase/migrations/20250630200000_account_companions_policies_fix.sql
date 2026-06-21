-- Safe to re-run if account_companions migration partially applied

alter table public.travelers add column if not exists managed_by_user_id uuid references auth.users(id) on delete set null;
alter table public.travelers add column if not exists account_companion_id uuid references public.account_companions(id) on delete set null;
alter table public.travelers add column if not exists can_vote boolean not null default true;
alter table public.travelers add column if not exists fills_own_preferences boolean not null default true;
alter table public.travelers add column if not exists delegated_to_user_id uuid references auth.users(id) on delete set null;

alter table public.account_companions add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

alter table public.account_companions enable row level security;

drop policy if exists "Owners manage account_companions" on public.account_companions;
create policy "Owners manage account_companions"
  on public.account_companions for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Trip members read linked companions" on public.account_companions;
create policy "Trip members read linked companions"
  on public.account_companions for select
  using (
    exists (
      select 1 from public.travelers tr
      where tr.account_companion_id = account_companions.id
        and public.user_can_access_trip(tr.trip_id)
    )
  );

grant all on public.account_companions to authenticated;
grant all on public.account_companions to anon;
