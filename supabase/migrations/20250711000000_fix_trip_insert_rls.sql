-- Trip INSERT was blocked: "Trip members trips" FOR ALL required user_can_access_trip(id)
-- before the organizer traveler row exists. Split member access from create/delete.

drop policy if exists "Trip members trips" on public.trips;

create policy "Trip members select trips"
  on public.trips for select
  using ((select private.user_can_access_trip(id)));

create policy "Trip members update trips"
  on public.trips for update
  using ((select private.user_can_access_trip(id)))
  with check ((select private.user_can_access_trip(id)));

-- INSERT: "Users create trips" (organizer_id = auth.uid())
-- DELETE: "Organizers delete trips" (organizer_id = auth.uid())
