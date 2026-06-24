-- Phase timer routes update trips.updated_at when opening/extending phases.
-- Run in Supabase SQL editor if not applied via migration tooling.

alter table public.trips add column if not exists updated_at timestamptz default now();

update public.trips
set updated_at = coalesce(created_at, now())
where updated_at is null;

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();
