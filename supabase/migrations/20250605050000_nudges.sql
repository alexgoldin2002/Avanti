create table if not exists nudges (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null,
  sender_id uuid,
  recipient_traveler_id uuid not null,
  sent_at timestamp with time zone default timezone('utc'::text, now())
);
alter table nudges disable row level security;
grant all on nudges to anon;
grant all on nudges to authenticated;
