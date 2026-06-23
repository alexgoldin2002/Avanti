-- Two-round destination voting (Step 2 → group vote)

create table if not exists public.destination_analysis (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  submitter_traveler_id uuid references public.travelers(id) on delete set null,
  destination_name text not null,
  country text,
  card_snapshot jsonb not null default '{}'::jsonb,
  pushed_to_vote boolean not null default false,
  advanced_to_round_two boolean not null default false,
  round_one_content jsonb,
  feasibility_floor integer,
  highest_member_max integer,
  created_at timestamptz not null default now(),
  unique (trip_id, destination_name)
);

create index if not exists destination_analysis_trip_id_idx
  on public.destination_analysis (trip_id);

create table if not exists public.round_one_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  destination_analysis_id uuid not null references public.destination_analysis(id) on delete cascade,
  rank integer not null check (rank >= 1),
  created_at timestamptz not null default now(),
  unique (trip_id, traveler_id, destination_analysis_id)
);

create index if not exists round_one_votes_trip_id_idx on public.round_one_votes (trip_id);

create table if not exists public.round_two_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  destination_analysis_id uuid not null references public.destination_analysis(id) on delete cascade,
  percentage integer not null check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now(),
  unique (trip_id, traveler_id, destination_analysis_id)
);

create index if not exists round_two_votes_trip_id_idx on public.round_two_votes (trip_id);

create table if not exists public.round_two_personalized_content (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  destination_analysis_id uuid not null references public.destination_analysis(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (trip_id, traveler_id, destination_analysis_id)
);

alter table public.travelers
  add column if not exists choices_submitted boolean not null default false;

alter table public.trips
  add column if not exists max_votes integer default 2,
  add column if not exists voting_round integer,
  add column if not exists total_cards integer,
  add column if not exists winning_destination_id uuid references public.destination_analysis(id) on delete set null;

alter table public.travelers
  add column if not exists round_one_submitted boolean not null default false,
  add column if not exists round_two_submitted boolean not null default false;

-- RLS
alter table public.destination_analysis enable row level security;
alter table public.round_one_votes enable row level security;
alter table public.round_two_votes enable row level security;
alter table public.round_two_personalized_content enable row level security;

drop policy if exists "Trip members destination_analysis" on public.destination_analysis;
create policy "Trip members destination_analysis"
  on public.destination_analysis for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

drop policy if exists "Trip members round_one_votes" on public.round_one_votes;
create policy "Trip members round_one_votes"
  on public.round_one_votes for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

drop policy if exists "Trip members round_two_votes" on public.round_two_votes;
create policy "Trip members round_two_votes"
  on public.round_two_votes for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

drop policy if exists "Trip members round_two_personalized_content" on public.round_two_personalized_content;
create policy "Trip members round_two_personalized_content"
  on public.round_two_personalized_content for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));

grant all on public.destination_analysis to authenticated;
grant all on public.destination_analysis to anon;
grant all on public.round_one_votes to authenticated;
grant all on public.round_one_votes to anon;
grant all on public.round_two_votes to authenticated;
grant all on public.round_two_votes to anon;
grant all on public.round_two_personalized_content to authenticated;
grant all on public.round_two_personalized_content to anon;
