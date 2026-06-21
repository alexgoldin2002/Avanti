alter table user_profiles add column if not exists benefits_profile jsonb default '{}';
