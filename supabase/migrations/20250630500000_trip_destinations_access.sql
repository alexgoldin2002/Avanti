-- trip_destinations RLS matched travelers by email only; members linked via user_id were blocked

drop policy if exists "Trip members can access destinations" on public.trip_destinations;
create policy "Trip members can access destinations"
  on public.trip_destinations for all
  using (public.user_can_access_trip(trip_id))
  with check (public.user_can_access_trip(trip_id));
