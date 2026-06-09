-- Run in Supabase SQL editor
alter table trips add column if not exists image_position jsonb default '{"x": 50, "y": 50, "scale": 1}';
