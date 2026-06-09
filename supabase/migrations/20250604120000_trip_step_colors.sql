-- Run in Supabase SQL editor
alter table trips add column if not exists step_colors jsonb;
alter table trips add column if not exists trip_index integer default 0;
