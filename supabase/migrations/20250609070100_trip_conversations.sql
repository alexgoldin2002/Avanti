create table if not exists trip_conversations (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null,
  user_id uuid not null,
  role text not null,
  content text,
  cards jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table trip_conversations disable row level security;
grant all on trip_conversations to anon;
grant all on trip_conversations to authenticated;
