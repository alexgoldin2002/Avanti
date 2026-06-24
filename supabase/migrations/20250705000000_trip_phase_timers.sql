-- Phase timers for brainstorm → voting → reveal

alter table trips add column if not exists brainstorm_duration_minutes integer default 2880;
alter table trips add column if not exists round_one_duration_minutes integer default 1440;
alter table trips add column if not exists round_two_duration_minutes integer default 2880;

alter table trips add column if not exists brainstorm_opened_at timestamptz;
alter table trips add column if not exists brainstorm_deadline_at timestamptz;
alter table trips add column if not exists brainstorm_closed_at timestamptz;

alter table trips add column if not exists voting_opened_at timestamptz;
alter table trips add column if not exists round_one_deadline_at timestamptz;
alter table trips add column if not exists round_one_closed_at timestamptz;

alter table trips add column if not exists round_two_opened_at timestamptz;
alter table trips add column if not exists round_two_deadline_at timestamptz;
alter table trips add column if not exists round_two_closed_at timestamptz;

comment on column trips.brainstorm_duration_minutes is 'Default 48h — card submission window after brainstorm opens';
comment on column trips.round_one_duration_minutes is 'Default 24h — Round 1 ranking window after voting opens';
comment on column trips.round_two_duration_minutes is 'Default 48h — Round 2 split window after all Round 1 votes in';
