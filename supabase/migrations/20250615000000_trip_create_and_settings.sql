alter table public.trips add column if not exists trip_type text;
alter table public.trips add column if not exists is_event_centered boolean default false;
alter table public.trips add column if not exists event_name text;
alter table public.trips add column if not exists event_date date;
alter table public.trips add column if not exists event_location text;
alter table public.trips add column if not exists max_votes integer default 2;
alter table public.trips add column if not exists invite_locked boolean default false;
