-- One-time welcome overlay on trip dashboard for newly accepted guests.
alter table public.travelers
  add column if not exists trip_dashboard_welcomed_at timestamptz;

comment on column public.travelers.trip_dashboard_welcomed_at is
  'Set when a guest dismisses the first-visit trip dashboard welcome overlay';
