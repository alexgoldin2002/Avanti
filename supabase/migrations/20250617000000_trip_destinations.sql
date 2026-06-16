create table if not exists public.trip_destinations (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null unique,
  cards jsonb default '[]',
  messages jsonb default '[]',
  closing_line text,
  votes jsonb default '{}',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.trip_destinations enable row level security;

create policy "Trip members can access destinations" on public.trip_destinations
  for all using (
    trip_id in (
      select id from public.trips where organizer_id = auth.uid()
      union
      select trip_id from public.travelers
      where email = (select email from public.user_profiles where user_id = auth.uid())
    )
  );
