-- Maximum date overlap across all travelers' Step 2 windows (recomputed on each save).
alter table public.trips add column if not exists group_overlap_start date;
alter table public.trips add column if not exists group_overlap_end date;
alter table public.trips add column if not exists group_overlap_nights integer;
alter table public.trips add column if not exists group_overlap_status text;
alter table public.trips add column if not exists group_overlap_computed_at timestamptz;

comment on column public.trips.group_overlap_start is 'Latest mutual start date across all travelers who entered Step 2 dates';
comment on column public.trips.group_overlap_end is 'Earliest mutual end date across those travelers';
comment on column public.trips.group_overlap_nights is 'Nights in the overlap window (0 if none yet)';
comment on column public.trips.group_overlap_status is 'ok | too_short | no_overlap | waiting';
