-- Destination Decision v1 schema
-- See docs/destination-decision-spec.md

create table if not exists public.destination_decisions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  status text not null default 'draft'
    check (status in (
      'draft', 'suggestions_open', 'analyzing', 'meta_vote', 'voting',
      'results', 'confirming', 'locked', 'cancelled'
    )),
  submission_deadline timestamptz,
  analysis_started_at timestamptz,
  analysis_completed_at timestamptz,
  voting_deadline timestamptz,
  confirm_deadline timestamptz,
  budget_strictness text not null default 'soft'
    check (budget_strictness in ('hard', 'soft', 'open')),
  group_priority_mode text
    check (group_priority_mode is null or group_priority_mode in ('budget', 'experience', 'balance')),
  locked_option_id uuid,
  winner_option_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id)
);

create table if not exists public.destination_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.destination_decisions(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  country text,
  tier text not null check (tier in ('budget', 'mid', 'luxury')),
  source text not null check (source in ('ai_card', 'member_suggestion')),
  source_traveler_id uuid references public.travelers(id) on delete set null,
  card_snapshot jsonb not null default '{}'::jsonb,
  group_summary jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists destination_options_decision_id_idx
  on public.destination_options (decision_id);
create index if not exists destination_options_trip_id_idx
  on public.destination_options (trip_id);

alter table public.destination_decisions
  add constraint destination_decisions_locked_option_id_fkey
  foreign key (locked_option_id) references public.destination_options(id) on delete set null;

alter table public.destination_decisions
  add constraint destination_decisions_winner_option_id_fkey
  foreign key (winner_option_id) references public.destination_options(id) on delete set null;

create table if not exists public.destination_option_analysis (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.destination_options(id) on delete cascade,
  traveler_id uuid not null references public.travelers(id) on delete cascade,
  scenarios jsonb not null default '{}'::jsonb,
  flags jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (option_id, traveler_id)
);

create index if not exists destination_option_analysis_option_id_idx
  on public.destination_option_analysis (option_id);

create table if not exists public.destination_option_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.destination_options(id) on delete cascade,
  user_id uuid not null,
  desire_score int check (desire_score is null or (desire_score >= 1 and desire_score <= 5)),
  approved boolean,
  toggles jsonb not null default '{}'::jsonb,
  private_max boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_id, user_id)
);

create table if not exists public.destination_meta_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.destination_decisions(id) on delete cascade,
  user_id uuid not null,
  priority text not null check (priority in ('budget', 'experience', 'balance')),
  created_at timestamptz not null default now(),
  unique (decision_id, user_id)
);

create table if not exists public.destination_confirmations (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.destination_decisions(id) on delete cascade,
  user_id uuid not null,
  confirmed boolean not null,
  stated_max_cost numeric,
  created_at timestamptz not null default now(),
  unique (decision_id, user_id)
);

alter table public.trips
  add column if not exists locked_tier text
    check (locked_tier is null or locked_tier in ('budget', 'mid', 'luxury'));
alter table public.trips
  add column if not exists locked_date_start date;
alter table public.trips
  add column if not exists locked_date_end date;
alter table public.trips
  add column if not exists destination_decision_id uuid
    references public.destination_decisions(id) on delete set null;

-- RLS: trip members + organizer
alter table public.destination_decisions enable row level security;
alter table public.destination_options enable row level security;
alter table public.destination_option_analysis enable row level security;
alter table public.destination_option_votes enable row level security;
alter table public.destination_meta_votes enable row level security;
alter table public.destination_confirmations enable row level security;

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
    join public.user_profiles up on up.email = tr.email
    where tr.trip_id = p_trip_id and up.user_id = auth.uid()
  );
$$;

create policy "Trip members destination_decisions"
  on public.destination_decisions for all
  using (public.user_can_access_trip(trip_id));

create policy "Trip members destination_options"
  on public.destination_options for all
  using (public.user_can_access_trip(trip_id));

create policy "Trip members destination_option_analysis"
  on public.destination_option_analysis for all
  using (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and public.user_can_access_trip(o.trip_id)
    )
  );

create policy "Trip members destination_option_votes"
  on public.destination_option_votes for all
  using (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and public.user_can_access_trip(o.trip_id)
    )
  );

create policy "Trip members destination_meta_votes"
  on public.destination_meta_votes for all
  using (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and public.user_can_access_trip(d.trip_id)
    )
  );

create policy "Trip members destination_confirmations"
  on public.destination_confirmations for all
  using (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and public.user_can_access_trip(d.trip_id)
    )
  );

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists destination_decisions_updated_at on public.destination_decisions;
create trigger destination_decisions_updated_at
  before update on public.destination_decisions
  for each row execute function public.set_updated_at();

drop trigger if exists destination_option_votes_updated_at on public.destination_option_votes;
create trigger destination_option_votes_updated_at
  before update on public.destination_option_votes
  for each row execute function public.set_updated_at();
