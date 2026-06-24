-- Move SECURITY DEFINER auth helpers out of PostgREST-exposed public schema.
-- Clears Supabase linter warnings 0028/0029 for user_can_access_trip RPC exposure.
-- Also fixes set_updated_at search_path (lint 0011).

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated, anon;

-- ─── Private helpers (not callable via /rest/v1/rpc) ─────────────────────────

create or replace function private.user_can_access_trip(p_trip_id uuid)
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

create or replace function private.trip_accepts_joins(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.invite_code is not null
      and coalesce(t.invites_closed, false) = false
      and coalesce(t.invite_locked, false) = false
  );
$$;

create or replace function private.trip_id_for_group_vote(p_vote_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gv.trip_id from public.group_votes gv where gv.id = p_vote_id;
$$;

revoke all on function private.user_can_access_trip(uuid) from public;
revoke all on function private.trip_accepts_joins(uuid) from public;
revoke all on function private.trip_id_for_group_vote(uuid) from public;

grant execute on function private.user_can_access_trip(uuid) to authenticated, anon, service_role;
grant execute on function private.trip_accepts_joins(uuid) to authenticated, anon, service_role;
grant execute on function private.trip_id_for_group_vote(uuid) to authenticated, anon, service_role;

-- ─── Core tables ─────────────────────────────────────────────────────────────

drop policy if exists "Trip members trips" on public.trips;
create policy "Trip members trips"
  on public.trips for all
  using ((select private.user_can_access_trip(id)))
  with check ((select private.user_can_access_trip(id)));

drop policy if exists "Trip members travelers" on public.travelers;
create policy "Trip members travelers"
  on public.travelers for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Invite preview organizers" on public.travelers;
create policy "Invite preview organizers"
  on public.travelers for select
  using (
    role = 'organizer'
    and (select private.trip_accepts_joins(trip_id))
  );

drop policy if exists "Users join open trips" on public.travelers;
create policy "Users join open trips"
  on public.travelers for insert
  with check (
    user_id = auth.uid()
    and (select private.trip_accepts_joins(trip_id))
  );

drop policy if exists "Trip members itineraries" on public.itineraries;
create policy "Trip members itineraries"
  on public.itineraries for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members nudges" on public.nudges;
create policy "Trip members nudges"
  on public.nudges for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_conversations" on public.trip_conversations;
create policy "Trip members trip_conversations"
  on public.trip_conversations for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_settings" on public.trip_settings;
create policy "Trip members trip_settings"
  on public.trip_settings for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_votes" on public.trip_votes;
create policy "Trip members trip_votes"
  on public.trip_votes for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members group_votes" on public.group_votes;
create policy "Trip members group_votes"
  on public.group_votes for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members group_vote_responses" on public.group_vote_responses;
create policy "Trip members group_vote_responses"
  on public.group_vote_responses for all
  using ((select private.user_can_access_trip((select private.trip_id_for_group_vote(vote_id)))))
  with check ((select private.user_can_access_trip((select private.trip_id_for_group_vote(vote_id)))));

-- ─── Destination voting ────────────────────────────────────────────────────────

drop policy if exists "Trip members destination_analysis" on public.destination_analysis;
create policy "Trip members destination_analysis"
  on public.destination_analysis for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members round_one_votes" on public.round_one_votes;
create policy "Trip members round_one_votes"
  on public.round_one_votes for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members round_two_votes" on public.round_two_votes;
create policy "Trip members round_two_votes"
  on public.round_two_votes for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members round_two_personalized_content" on public.round_two_personalized_content;
create policy "Trip members round_two_personalized_content"
  on public.round_two_personalized_content for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

-- ─── Destination decisions ───────────────────────────────────────────────────

drop policy if exists "Trip members destination_decisions" on public.destination_decisions;
create policy "Trip members destination_decisions"
  on public.destination_decisions for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members destination_options" on public.destination_options;
create policy "Trip members destination_options"
  on public.destination_options for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members destination_option_analysis" on public.destination_option_analysis;
create policy "Trip members destination_option_analysis"
  on public.destination_option_analysis for all
  using (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and (select private.user_can_access_trip(o.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and (select private.user_can_access_trip(o.trip_id))
    )
  );

drop policy if exists "Trip members destination_option_votes" on public.destination_option_votes;
create policy "Trip members destination_option_votes"
  on public.destination_option_votes for all
  using (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and (select private.user_can_access_trip(o.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.destination_options o
      where o.id = option_id and (select private.user_can_access_trip(o.trip_id))
    )
  );

drop policy if exists "Trip members destination_meta_votes" on public.destination_meta_votes;
create policy "Trip members destination_meta_votes"
  on public.destination_meta_votes for all
  using (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and (select private.user_can_access_trip(d.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and (select private.user_can_access_trip(d.trip_id))
    )
  );

drop policy if exists "Trip members destination_confirmations" on public.destination_confirmations;
create policy "Trip members destination_confirmations"
  on public.destination_confirmations for all
  using (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and (select private.user_can_access_trip(d.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.destination_decisions d
      where d.id = decision_id and (select private.user_can_access_trip(d.trip_id))
    )
  );

-- ─── Trip destinations, bookings, flights, companions ────────────────────────

drop policy if exists "Trip members can access destinations" on public.trip_destinations;
create policy "Trip members can access destinations"
  on public.trip_destinations for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_booking_inbox" on public.trip_booking_inbox;
create policy "Trip members trip_booking_inbox"
  on public.trip_booking_inbox for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_bookings" on public.trip_bookings;
create policy "Trip members trip_bookings"
  on public.trip_bookings for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_booking_files" on public.trip_booking_files;
create policy "Trip members trip_booking_files"
  on public.trip_booking_files for all
  using (
    exists (
      select 1 from public.trip_bookings b
      where b.id = booking_id and (select private.user_can_access_trip(b.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.trip_bookings b
      where b.id = booking_id and (select private.user_can_access_trip(b.trip_id))
    )
  );

drop policy if exists "Trip members trip_flight_sessions" on public.trip_flight_sessions;
create policy "Trip members trip_flight_sessions"
  on public.trip_flight_sessions for all
  using ((select private.user_can_access_trip(trip_id)))
  with check ((select private.user_can_access_trip(trip_id)));

drop policy if exists "Trip members trip_flight_member_prefs" on public.trip_flight_member_prefs;
create policy "Trip members trip_flight_member_prefs"
  on public.trip_flight_member_prefs for all
  using (
    exists (
      select 1 from public.trip_flight_sessions s
      where s.id = session_id and (select private.user_can_access_trip(s.trip_id))
    )
  )
  with check (
    exists (
      select 1 from public.trip_flight_sessions s
      where s.id = session_id and (select private.user_can_access_trip(s.trip_id))
    )
  );

drop policy if exists "Trip members read linked companions" on public.account_companions;
create policy "Trip members read linked companions"
  on public.account_companions for select
  using (
    exists (
      select 1 from public.travelers tr
      where tr.account_companion_id = account_companions.id
        and (select private.user_can_access_trip(tr.trip_id))
    )
  );

-- ─── Remove public RPC-exposed copies ────────────────────────────────────────

drop function if exists public.user_can_access_trip(uuid);
drop function if exists public.trip_accepts_joins(uuid);
drop function if exists public.trip_id_for_group_vote(uuid);

-- ─── Trigger helper search_path ──────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
