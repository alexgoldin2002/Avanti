-- Enable RLS on core tables flagged by Supabase security linter.
-- Run once in Supabase SQL editor (Production). Test join + create trip after.

-- Helpers (idempotent; matches destination_decisions migration)
create or replace function public.user_can_access_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.organizer_id = auth.uid()
  )
  or exists (
    select 1 from public.travelers tr
    where tr.trip_id = p_trip_id and tr.user_id = auth.uid()
  )
  or exists (
    select 1 from public.travelers tr
    join public.user_profiles up on up.email = tr.email
    where tr.trip_id = p_trip_id and up.user_id = auth.uid()
  );
$$;

create or replace function public.trip_accepts_joins(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.invite_code is not null
      and coalesce(t.invites_closed, false) = false
      and coalesce(t.invite_locked, false) = false
  );
$$;

create or replace function public.trip_id_for_group_vote(p_vote_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gv.trip_id from public.group_votes gv where gv.id = p_vote_id;
$$;

-- ─── trips ───────────────────────────────────────────────────────────────────

alter table public.trips enable row level security;

drop policy if exists "Allow insert trips" on public.trips;
drop policy if exists "Allow select trips" on public.trips;
drop policy if exists "Allow update trips" on public.trips;
drop policy if exists "Trip members trips" on public.trips;
drop policy if exists "Invite preview trips" on public.trips;
drop policy if exists "Users create trips" on public.trips;
drop policy if exists "Organizers delete trips" on public.trips;

create policy "Trip members trips"
  on public.trips for all
  using (public.user_can_access_trip(id))
  with check (public.user_can_access_trip(id));

create policy "Invite preview trips"
  on public.trips for select
  using (
    invite_code is not null
    and coalesce(invites_closed, false) = false
    and coalesce(invite_locked, false) = false
  );

create policy "Users create trips"
  on public.trips for insert
  with check (organizer_id = auth.uid());

create policy "Organizers delete trips"
  on public.trips for delete
  using (organizer_id = auth.uid());

-- ─── travelers ───────────────────────────────────────────────────────────────

alter table public.travelers enable row level security;

drop policy if exists "Allow insert travelers" on public.travelers;
drop policy if exists "Allow select travelers" on public.travelers;
drop policy if exists "Allow update travelers" on public.travelers;
drop policy if exists "Trip members travelers" on public.travelers;
drop policy if exists "Invite preview organizers" on public.travelers;
drop policy if exists "Users join open trips" on public.travelers;

create policy "Trip members travelers"
  on public.travelers for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

create policy "Invite preview organizers"
  on public.travelers for select
  using (
    role = 'organizer'
    and public.trip_accepts_joins(trip_id)
  );

create policy "Users join open trips"
  on public.travelers for insert
  with check (
    user_id = auth.uid()
    and public.trip_accepts_joins(trip_id)
  );

-- ─── itineraries ─────────────────────────────────────────────────────────────

alter table public.itineraries enable row level security;

drop policy if exists "Allow insert itineraries" on public.itineraries;
drop policy if exists "Allow select itineraries" on public.itineraries;
drop policy if exists "Allow update itineraries" on public.itineraries;
drop policy if exists "Allow upsert itineraries" on public.itineraries;
drop policy if exists "Trip members itineraries" on public.itineraries;

create policy "Trip members itineraries"
  on public.itineraries for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

-- ─── user_profiles ───────────────────────────────────────────────────────────

alter table public.user_profiles enable row level security;

drop policy if exists "Users own profile" on public.user_profiles;

create policy "Users own profile"
  on public.user_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── user_wallets ────────────────────────────────────────────────────────────

alter table public.user_wallets enable row level security;

drop policy if exists "Users own wallet" on public.user_wallets;

create policy "Users own wallet"
  on public.user_wallets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── trip-scoped tables ──────────────────────────────────────────────────────

alter table public.nudges enable row level security;
drop policy if exists "Trip members nudges" on public.nudges;
create policy "Trip members nudges"
  on public.nudges for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

alter table public.trip_conversations enable row level security;
drop policy if exists "Trip members trip_conversations" on public.trip_conversations;
create policy "Trip members trip_conversations"
  on public.trip_conversations for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

alter table public.trip_settings enable row level security;
drop policy if exists "Trip members trip_settings" on public.trip_settings;
create policy "Trip members trip_settings"
  on public.trip_settings for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

alter table public.trip_votes enable row level security;
drop policy if exists "Trip members trip_votes" on public.trip_votes;
create policy "Trip members trip_votes"
  on public.trip_votes for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

alter table public.group_votes enable row level security;
drop policy if exists "Trip members group_votes" on public.group_votes;
create policy "Trip members group_votes"
  on public.group_votes for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

alter table public.group_vote_responses enable row level security;
drop policy if exists "Trip members group_vote_responses" on public.group_vote_responses;
create policy "Trip members group_vote_responses"
  on public.group_vote_responses for all
  using (public.user_can_access_trip(public.trip_id_for_group_vote(vote_id)))
  with check (public.user_can_access_trip(public.trip_id_for_group_vote(vote_id)));
