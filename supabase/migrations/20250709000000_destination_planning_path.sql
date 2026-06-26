-- Step 2 planning path: known destination, considering list, or full brainstorm
alter table trips add column if not exists destination_planning_path text;

comment on column trips.destination_planning_path is
  'known | considering | brainstorm — how the group chose their destination in Step 2';
