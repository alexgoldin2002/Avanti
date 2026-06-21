-- expenses table had RLS policies but no role grants (unlike nudges, trip_settings, etc.)

grant all on public.expenses to authenticated;
grant all on public.expenses to anon;
