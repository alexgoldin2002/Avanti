import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { finalizeExpiredPhases } from '@/lib/trip-phases/finalize'
import { buildTripPhasesPayload } from '@/lib/trip-phases/state'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const traveler = await findTravelerForUser(userClient, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? userClient
    await finalizeExpiredPhases(db, tripId)

    const { data: trip } = await userClient.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const { data: travelerFull } = await userClient
      .from('travelers')
      .select('choices_submitted, round_one_submitted, round_two_submitted')
      .eq('id', traveler.id)
      .single()

    const payload = buildTripPhasesPayload(
      trip,
      travelerFull || traveler,
      trip.organizer_id === user.id,
      tripId
    )

    return NextResponse.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = await request.json()
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)

    const { data: trip } = await userClient
      .from('trips')
      .select('organizer_id, voting_round, brainstorm_opened_at')
      .eq('id', tripId)
      .single()

    if (!trip || trip.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Organizer only' }, { status: 403 })
    }

    if (trip.voting_round != null) {
      return NextResponse.json({ error: 'Cannot change durations after voting has started' }, { status: 400 })
    }

    const patch: Record<string, number | string> = { updated_at: new Date().toISOString() }
    if (typeof body.brainstormDurationMinutes === 'number') {
      patch.brainstorm_duration_minutes = Math.max(60, Math.floor(body.brainstormDurationMinutes))
    }
    if (typeof body.roundOneDurationMinutes === 'number') {
      patch.round_one_duration_minutes = Math.max(60, Math.floor(body.roundOneDurationMinutes))
    }
    if (typeof body.roundTwoDurationMinutes === 'number') {
      patch.round_two_duration_minutes = Math.max(60, Math.floor(body.roundTwoDurationMinutes))
    }

    const db = tryCreateAdminClient() ?? userClient
    const { error } = await db.from('trips').update(patch).eq('id', tripId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
