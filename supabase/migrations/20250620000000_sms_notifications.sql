alter table user_profiles
  add column if not exists sms_notifications_enabled boolean default true;

create table if not exists sms_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  phone text not null,
  body text not null,
  message_type text,
  trip_id uuid,
  status text default 'sent',
  provider_message_id text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table sms_messages disable row level security;
