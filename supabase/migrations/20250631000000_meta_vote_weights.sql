-- Run in Supabase SQL editor if not applied via CLI
alter table public.destination_meta_votes
  add column if not exists weights jsonb;
