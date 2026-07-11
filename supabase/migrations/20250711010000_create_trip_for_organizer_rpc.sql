-- SECURITY DEFINER RPC: create trip + organizer traveler without relying on
-- service-role env vars or INSERT policies that require prior membership.

create or replace function public.create_trip_for_organizer(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_email text;
  v_is_event boolean := coalesce((p_payload->>'is_event_centered')::boolean, false);
begin
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  if coalesce(trim(p_payload->>'name'), '') = ''
     or coalesce(trim(p_payload->>'trip_type'), '') = '' then
    raise exception 'Trip name and group type are required';
  end if;

  v_email := coalesce(
    nullif(trim(p_payload#>>'{traveler,email}'), ''),
    (select u.email::text from auth.users u where u.id = v_user limit 1),
    ''
  );

  insert into public.trips (
    name,
    trip_type,
    destination,
    destination_type,
    date_type,
    cover_color,
    organizer_id,
    status,
    is_event_centered,
    event_name,
    event_date,
    event_date_end,
    event_location
  ) values (
    trim(p_payload->>'name'),
    trim(p_payload->>'trip_type'),
    coalesce(p_payload->>'destination', 'TBD'),
    coalesce(p_payload->>'destination_type', 'flexible'),
    coalesce(p_payload->>'date_type', 'flexible'),
    coalesce(p_payload->>'cover_color', 'oklch(0.22 0.04 150)'),
    v_user,
    coalesce(p_payload->>'status', 'planning'),
    v_is_event,
    case when v_is_event then nullif(p_payload->>'event_name', '') else null end,
    case when v_is_event then nullif(p_payload->>'event_date', '')::date else null end,
    case when v_is_event then nullif(p_payload->>'event_date_end', '')::date else null end,
    case when v_is_event then nullif(trim(p_payload->>'event_location'), '') else null end
  )
  returning * into v_trip;

  insert into public.travelers (
    trip_id,
    user_id,
    full_name,
    email,
    nickname,
    role,
    profile_complete
  ) values (
    v_trip.id,
    v_user,
    coalesce(p_payload#>>'{traveler,full_name}', ''),
    v_email,
    coalesce(
      nullif(trim(p_payload#>>'{traveler,nickname}'), ''),
      nullif(split_part(coalesce(p_payload#>>'{traveler,full_name}', ''), ' ', 1), ''),
      ''
    ),
    'organizer',
    coalesce((p_payload#>>'{traveler,profile_complete}')::boolean, true)
  );

  return jsonb_build_object('trip', to_jsonb(v_trip));
end;
$$;

revoke all on function public.create_trip_for_organizer(jsonb) from public;
grant execute on function public.create_trip_for_organizer(jsonb) to authenticated;
