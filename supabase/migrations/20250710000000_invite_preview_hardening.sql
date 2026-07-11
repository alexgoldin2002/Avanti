-- Harden invite preview: stop exposing full traveler/trip rows to anon.
--
-- Problem: the "Invite preview organizers" (travelers) and "Invite preview trips"
-- (trips) policies granted anon/authenticated SELECT on the ENTIRE row for any
-- open, invitable trip. That leaked organizer PII (email, the step2 preferences
-- blob, etc.) and the full trips row to anyone who could guess/enumerate.
--
-- Fix: expose only the handful of fields the /join/[code] landing page needs
-- through a SECURITY DEFINER function, and remove the wide row policies. The
-- function is the sole anon entry point for invite previews.

-- ─── Safe, minimal invite preview ────────────────────────────────────────────

create or replace function public.invite_preview(p_invite_code text)
returns table (
  trip_id uuid,
  trip_name text,
  destination text,
  start_date date,
  end_date date,
  cover_image text,
  cover_color text,
  invites_closed boolean,
  invite_locked boolean,
  organizer_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.destination,
    t.start_date,
    t.end_date,
    t.cover_image,
    t.cover_color,
    coalesce(t.invites_closed, false),
    coalesce(t.invite_locked, false),
    coalesce(
      nullif(org.nickname, ''),
      nullif(split_part(coalesce(org.full_name, ''), ' ', 1), ''),
      'Someone'
    )
  from public.trips t
  left join lateral (
    select nickname, full_name
    from public.travelers
    where trip_id = t.id and role = 'organizer'
    order by joined_at asc nulls last
    limit 1
  ) org on true
  where p_invite_code is not null
    and t.invite_code = p_invite_code
  limit 1;
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated, service_role;

-- ─── Remove the over-broad anon row policies ─────────────────────────────────

drop policy if exists "Invite preview organizers" on public.travelers;
drop policy if exists "Invite preview trips" on public.trips;
