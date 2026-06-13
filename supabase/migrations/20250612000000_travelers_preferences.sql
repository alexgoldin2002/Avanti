alter table public.travelers add column if not exists preferences jsonb default '{}';
