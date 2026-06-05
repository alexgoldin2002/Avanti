-- Run this in Supabase SQL editor
alter table trips add column if not exists cover_color text default '#1a1a1a';
alter table trips add column if not exists cover_image text;
alter table trips add column if not exists date_type text default 'exact';
alter table trips add column if not exists date_range_start date;
alter table trips add column if not exists date_range_end date;
alter table trips add column if not exists date_flexibility_nights integer;
alter table trips add column if not exists dates_locked boolean default false;
alter table trips add column if not exists destination_type text default 'set';
alter table trips add column if not exists destinations jsonb default '[]';
alter table trips add column if not exists join_code text default substr(md5(random()::text), 1, 6);
alter table trips add column if not exists visibility text default 'invite_only';

alter table travelers add column if not exists nickname text;
alter table travelers add column if not exists role text default 'member';
alter table travelers add column if not exists availability_start date;
alter table travelers add column if not exists availability_end date;
alter table travelers add column if not exists joined_at timestamp with time zone default now();
