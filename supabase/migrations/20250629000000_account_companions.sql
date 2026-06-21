-- People managed under a user's account + trip-level delegation

create table if not exists public.account_companions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  nickname text,
  relationship text,
  date_of_birth date,
  passport_number text,
  passport_expiry text,
  tsa_known_traveler text,
  departure_city text,
  dietary_restrictions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_companions_owner on public.account_companions(owner_user_id);

alter table public.travelers add column if not exists managed_by_user_id uuid references auth.users(id) on delete set null;
alter table public.travelers add column if not exists account_companion_id uuid references public.account_companions(id) on delete set null;
alter table public.travelers add column if not exists can_vote boolean not null default true;
alter table public.travelers add column if not exists fills_own_preferences boolean not null default true;
alter table public.travelers add column if not exists delegated_to_user_id uuid references auth.users(id) on delete set null;

comment on column public.travelers.managed_by_user_id is 'User who fills preferences and votes on behalf of this traveler';
comment on column public.travelers.can_vote is 'False when traveler delegated decisions to someone else';
comment on column public.travelers.fills_own_preferences is 'False for dependents managed by another member';

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
