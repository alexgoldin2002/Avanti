-- destination_decisions tables had RLS but no role grants (same pattern as expenses)

grant all on public.destination_decisions to authenticated;
grant all on public.destination_decisions to anon;
grant all on public.destination_options to authenticated;
grant all on public.destination_options to anon;
grant all on public.destination_option_analysis to authenticated;
grant all on public.destination_option_analysis to anon;
grant all on public.destination_option_votes to authenticated;
grant all on public.destination_option_votes to anon;
grant all on public.destination_meta_votes to authenticated;
grant all on public.destination_meta_votes to anon;
grant all on public.destination_confirmations to authenticated;
grant all on public.destination_confirmations to anon;

-- Match travelers by user_id (not email only)
create or replace function public.user_can_access_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.organizer_id = auth.uid()
  )
  or exists (
    select 1 from public.travelers tr
    where tr.trip_id = p_trip_id and tr.user_id = auth.uid()
  )
  or exists (
    select 1 from public.travelers tr
    join public.user_profiles up on up.email = tr.email
    where tr.trip_id = p_trip_id and up.user_id = auth.uid()
  );
$$;

drop policy if exists "Trip members destination_decisions" on public.destination_decisions;
create policy "Trip members destination_decisions"
  on public.destination_decisions for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));
