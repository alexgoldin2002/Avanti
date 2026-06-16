alter table public.trip_destinations add column if not exists why_not jsonb default '[]';
alter table public.travelers add column if not exists votes jsonb default '{}';
