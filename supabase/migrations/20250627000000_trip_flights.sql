-- Step 4: Flights coordination, preferences, analysis, lock

create table if not exists trip_flight_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references trips(id) on delete cascade,
  status text not null default 'setup'
    check (status in ('setup', 'preferences', 'analyzing', 'review', 'locked')),
  coordination_mode text
    check (coordination_mode is null or coordination_mode in ('together', 'independent', 'mix')),
  mix_notes text,
  vote_estimate_per_person numeric,
  analysis jsonb default '{}'::jsonb,
  selected_scenario_id text,
  locked_summary jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_flight_sessions_trip on trip_flight_sessions(trip_id);

create table if not exists trip_flight_member_prefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references trip_flight_sessions(id) on delete cascade,
  traveler_id uuid not null references travelers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  direct_preference text not null default 'one_stop_ok'
    check (direct_preference in ('nonstop_only', 'one_stop_ok', 'any_stops', 'cheapest')),
  preferred_airlines text[] not null default '{}',
  avoid_airlines text[] not null default '{}',
  cost_vs_time text not null default 'balance'
    check (cost_vs_time in ('cost', 'balance', 'time')),
  wants_group_routing boolean,
  notes text,
  updated_at timestamptz not null default now(),
  unique (session_id, traveler_id)
);

create index if not exists idx_trip_flight_member_prefs_session on trip_flight_member_prefs(session_id);

alter table trips add column if not exists flights_locked boolean not null default false;
alter table trips add column if not exists flights_locked_at timestamptz;

comment on column trips.flights_locked is 'Step 4 complete — hotel search may use fixed dates';
comment on column trip_flight_sessions.analysis is 'AI-generated scenarios: routing, timing, ground transport, group sync';

-- RLS (uses user_can_access_trip from destination_decisions migration)
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
