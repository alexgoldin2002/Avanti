create table if not exists trip_settings (
  trip_id uuid primary key,
  max_vote_options_per_person integer default 3,
  show_member_conversations boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table trip_settings disable row level security;
grant all on trip_settings to anon;
grant all on trip_settings to authenticated;

alter table group_votes add column if not exists submission_deadline timestamp with time zone;
alter table group_votes add column if not exists voting_deadline timestamp with time zone;
alter table group_votes add column if not exists current_round integer default 1;
alter table group_votes add column if not exists round_results jsonb default '[]'::jsonb;
alter table group_votes add column if not exists winner jsonb;

create table if not exists group_vote_responses (
  id uuid default gen_random_uuid() primary key,
  vote_id uuid not null,
  user_id uuid not null,
  option_index integer not null,
  round integer default 1,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique (vote_id, user_id, option_index, round)
);
alter table group_vote_responses disable row level security;
grant all on group_vote_responses to anon;
grant all on group_vote_responses to authenticated;
