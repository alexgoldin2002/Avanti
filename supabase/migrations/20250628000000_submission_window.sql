alter table trips add column if not exists submission_window_minutes integer default 2880;

comment on column trips.submission_window_minutes is 'Default suggestion window length (minutes) set when host starts Step 2';
