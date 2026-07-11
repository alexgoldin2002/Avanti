-- Step 4 (dashboard): Accommodation coordination, preferences, analysis, lock

create table if not exists trip_accommodation_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references trips(id) on delete cascade,
  status text not null default 'setup'
    check (status in ('setup', 'preferences', 'analyzing', 'review', 'locked')),
  coordination_mode text
    check (coordination_mode is null or coordination_mode in ('together', 'split', 'mix')),
  mix_notes text,
  vote_estimate_per_night numeric,
  analysis jsonb default '{}'::jsonb,
  selected_option_id text,
  locked_summary jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_accommodation_sessions_trip on trip_accommodation_sessions(trip_id);

create table if not exists trip_accommodation_member_prefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references trip_accommodation_sessions(id) on delete cascade,
  traveler_id uuid not null references travelers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  stay_type text not null default 'any'
    check (stay_type in ('hotel', 'resort', 'rental', 'boutique', 'any')),
  private_room boolean not null default true,
  shared_space_ok boolean not null default true,
  max_budget_per_night numeric,
  neighborhood_notes text,
  amenities text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now(),
  unique (session_id, traveler_id)
);

create index if not exists idx_trip_accommodation_member_prefs_session on trip_accommodation_member_prefs(session_id);

alter table trips add column if not exists accommodation_locked boolean not null default false;
alter table trips add column if not exists accommodation_locked_at timestamptz;

comment on column trips.accommodation_locked is 'Step 4 complete — activities/dining can proceed with locked stay';
comment on column trip_accommodation_sessions.analysis is 'AI + live hotel/rental options with book links';

alter table public.trip_accommodation_sessions enable row level security;
alter table public.trip_accommodation_member_prefs enable row level security;

drop policy if exists "Trip members trip_accommodation_sessions" on public.trip_accommodation_sessions;
create policy "Trip members trip_accommodation_sessions"
  on public.trip_accommodation_sessions for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_accommodation_member_prefs" on public.trip_accommodation_member_prefs;
create policy "Trip members trip_accommodation_member_prefs"
  on public.trip_accommodation_member_prefs for all
  using (
    exists (
      select 1 from public.trip_accommodation_sessions s
      where s.id = session_id and (select private.user_can_access_trip(s.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.trip_accommodation_sessions s
      where s.id = session_id and (select private.user_can_access_trip(s.trip_id))
    )
  );

grant all on public.trip_accommodation_sessions to authenticated;
grant all on public.trip_accommodation_sessions to anon;
grant all on public.trip_accommodation_member_prefs to authenticated;
grant all on public.trip_accommodation_member_prefs to anon;
