-- Safe to re-run if trip_flights migration partially applied (policies already exist)

alter table trips add column if not exists flights_locked boolean not null default false;
alter table trips add column if not exists flights_locked_at timestamptz;

alter table public.trip_flight_sessions enable row level security;
alter table public.trip_flight_member_prefs enable row level security;

drop policy if exists "Trip members trip_flight_sessions" on public.trip_flight_sessions;
create policy "Trip members trip_flight_sessions"
  on public.trip_flight_sessions for all
  using (public.user_can_access_trip(trip_id));

drop policy if exists "Trip members trip_flight_member_prefs" on public.trip_flight_member_prefs;
create policy "Trip members trip_flight_member_prefs"
  on public.trip_flight_member_prefs for all
  using (
    exists (
      select 1 from public.trip_flight_sessions s
      where s.id = session_id and public.user_can_access_trip(s.trip_id)
    )
  );

grant all on public.trip_flight_sessions to authenticated;
grant all on public.trip_flight_sessions to anon;
grant all on public.trip_flight_member_prefs to authenticated;
grant all on public.trip_flight_member_prefs to anon;
