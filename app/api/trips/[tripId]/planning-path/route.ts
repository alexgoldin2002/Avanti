import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { openBrainstormTimestamps } from '@/lib/trip-phases/finalize'
import { isDestinationPlanningPath } from '@/lib/step2/planning-path'
import { parseFlexLengthMinNights } from '@/lib/group-date-overlap'
import { isValidDateRange } from '@/lib/date-range'

type KnownDatesMode = 'Fixed dates' | 'Flexible — I have a range'

type PlanningPathBody = {
  path: string
  knownDestinations?: string[]
  dates?: KnownDatesMode
  fixedDates?: { start?: string; end?: string }
  flexLength?: string
}

function buildKnownDatePatch(body: PlanningPathBody): Record<string, unknown> {
  const start = body.fixedDates?.start?.trim() || ''
  const end = body.fixedDates?.end?.trim() || ''
  if (!body.dates || !isValidDateRange(start, end)) {
    throw new Error('Enter valid trip dates')
  }

  if (body.dates === 'Fixed dates') {
    return {
      date_type: 'exact',
      start_date: start,
      end_date: end,
      date_range_start: null,
      date_range_end: null,
      date_flexibility_nights: null,
      dates_locked: true,
    }
  }

  const flexLength = body.flexLength?.trim()
  if (!flexLength) {
    throw new Error('Select a preferred trip length')
  }

  const nights = parseFlexLengthMinNights(flexLength) ?? 5
  return {
    date_type: 'flexible',
    start_date: null,
    end_date: null,
    date_range_start: start,
    date_range_end: end,
    date_flexibility_nights: nights,
    dates_locked: false,
  }
}

/** Organizer picks Step 2 path and unlocks planning. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = (await request.json()) as PlanningPathBody
    const path = body.path

    if (!isDestinationPlanningPath(path)) {
      return NextResponse.json({ error: 'Invalid planning path' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    if (trip.destination_planning_path) {
      return NextResponse.json({ error: 'Planning path already set for this trip' }, { status: 409 })
    }

    const now = new Date()

    if (path === 'known') {
      const places = (body.knownDestinations || [])
        .map(s => s.trim())
        .filter(Boolean)
      if (places.length === 0) {
        return NextResponse.json({ error: 'Enter at least one destination' }, { status: 400 })
      }

      let datePatch: Record<string, unknown>
      try {
        datePatch = buildKnownDatePatch(body)
      } catch (dateErr) {
        const msg = dateErr instanceof Error ? dateErr.message : 'Invalid dates'
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      const destinationLabel = places.join(' · ')
      const closedAt = now.toISOString()

      const { error } = await supabase
        .from('trips')
        .update({
          invites_closed: true,
          destination_planning_path: 'known',
          destination_type: 'set',
          destination: destinationLabel,
          winning_destination_id: null,
          brainstorm_closed_at: closedAt,
          updated_at: closedAt,
          ...datePatch,
        })
        .eq('id', tripId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const { data: organizerTraveler } = await supabase
        .from('travelers')
        .select('id, step2')
        .eq('trip_id', tripId)
        .eq('role', 'organizer')
        .maybeSingle()

      if (organizerTraveler) {
        const existingStep2 = (organizerTraveler.step2 as Record<string, unknown> | null) || {}
        await supabase
          .from('travelers')
          .update({
            step2: {
              ...existingStep2,
              dates: body.dates,
              fixedDates: {
                start: body.fixedDates?.start?.trim() || '',
                end: body.fixedDates?.end?.trim() || '',
              },
              flexLength: body.flexLength?.trim() || '',
              consideringList: places,
              stage: 'done',
            },
          })
          .eq('id', organizerTraveler.id)
      }

      return NextResponse.json({
        ok: true,
        path,
        // Destination is locked, but the organizer still needs to give the same
        // travel preferences the other paths collect (departure city, vibe, budget…).
        redirectTo: `/trips/${tripId}/step2/preferences`,
        destination: destinationLabel,
      })
    }

    const patch = {
      ...openBrainstormTimestamps(trip, now),
      destination_planning_path: path,
    }

    const { error } = await supabase.from('trips').update(patch).eq('id', tripId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      path,
      redirectTo: `/trips/${tripId}/step2`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Organizer clears 2B/2C path to pick 2A / 2B / 2C again (before voting). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    if (trip.destination_planning_path === 'known') {
      return NextResponse.json(
        { error: 'Known-destination trips cannot change path here — edit from the trip dashboard.' },
        { status: 400 },
      )
    }

    if (!trip.destination_planning_path) {
      return NextResponse.json({ ok: true, redirectTo: `/trips/${tripId}/step2/path` })
    }

    if (trip.voting_round != null && trip.voting_round >= 1) {
      return NextResponse.json(
        { error: 'Voting has started — the planning path can no longer be changed.' },
        { status: 409 },
      )
    }

    const { error } = await supabase
      .from('trips')
      .update({
        destination_planning_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      redirectTo: `/trips/${tripId}/step2/path`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
