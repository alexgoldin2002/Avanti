-- Saved inspiration from social links, articles, screenshots
create table if not exists trip_inspirations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('url', 'screenshot', 'paste')),
  source_url text,
  source_platform text,
  screenshot_path text,
  place_name text not null,
  place_category text,
  place_address text,
  place_city text,
  place_description text,
  parsed_json jsonb not null default '{}'::jsonb,
  suggested_day_date date,
  suggested_time text,
  suggestion_reason text,
  status text not null default 'saved' check (status in ('saved', 'added_to_itinerary', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_inspirations_trip_id_idx on trip_inspirations(trip_id);

alter table trip_inspirations enable row level security;

create policy "Trip members can view inspirations"
  on trip_inspirations for select
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = trip_inspirations.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = trip_inspirations.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can insert inspirations"
  on trip_inspirations for insert
  with check (
    exists (
      select 1 from travelers t
      where t.trip_id = trip_inspirations.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = trip_inspirations.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can update inspirations"
  on trip_inspirations for update
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = trip_inspirations.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = trip_inspirations.trip_id
        and tr.organizer_id = auth.uid()
    )
  );

create policy "Trip members can delete inspirations"
  on trip_inspirations for delete
  using (
    exists (
      select 1 from travelers t
      where t.trip_id = trip_inspirations.trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from trips tr
      where tr.id = trip_inspirations.trip_id
        and tr.organizer_id = auth.uid()
    )
  );
