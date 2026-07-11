import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { votingComplete } from '@/lib/trip-phases/state'

/**
 * Organizer "Start over" — wipes ALL Step 2 progress (planning path, questionnaire
 * answers, generated cards/matrix, and both voting rounds) and returns the trip to
 * the path picker. Blocked once the destination has been finalized.
 */
export async function POST(
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

    if (votingComplete(trip)) {
      return NextResponse.json(
        { error: 'The destination is already finalized — Step 2 can no longer be reset.' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    // 1) Reset the trip's Step 2 state back to "path not chosen yet".
    const { error: tripError } = await supabase
      .from('trips')
      .update({
        destination_planning_path: null,
        destination: 'TBD',
        destination_type: 'flexible',
        winning_destination_id: null,
        voting_round: null,
        total_cards: null,
        // brainstorm + voting phase timers
        brainstorm_opened_at: null,
        brainstorm_deadline_at: null,
        brainstorm_closed_at: null,
        voting_opened_at: null,
        round_one_deadline_at: null,
        round_one_closed_at: null,
        round_two_opened_at: null,
        round_two_deadline_at: null,
        round_two_closed_at: null,
        // group date overlap (recomputed from traveler dates, which we're clearing)
        group_overlap_start: null,
        group_overlap_end: null,
        group_overlap_nights: null,
        group_overlap_status: null,
        group_overlap_computed_at: null,
        // trip-level dates only set by the 2A known path
        date_type: null,
        start_date: null,
        end_date: null,
        date_range_start: null,
        date_range_end: null,
        date_flexibility_nights: null,
        dates_locked: false,
        updated_at: now,
      })
      .eq('id', tripId)

    if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 })

    // 2) Clear every traveler's Step 2 answers + voting flags.
    const { error: travelerError } = await supabase
      .from('travelers')
      .update({
        step2: {},
        choices_submitted: false,
        round_one_submitted: false,
        round_two_submitted: false,
      })
      .eq('trip_id', tripId)

    if (travelerError) return NextResponse.json({ error: travelerError.message }, { status: 500 })

    // 3) Delete generated destinations + votes (child rows keyed by trip_id).
    //    Vote/personalized-content rows also cascade from destination_analysis, but we
    //    delete them explicitly so a missing table doesn't leave orphans.
    await supabase.from('round_two_personalized_content').delete().eq('trip_id', tripId)
    await supabase.from('round_two_votes').delete().eq('trip_id', tripId)
    await supabase.from('round_one_votes').delete().eq('trip_id', tripId)
    await supabase.from('destination_analysis').delete().eq('trip_id', tripId)
    await supabase.from('trip_conversations').delete().eq('trip_id', tripId)

    return NextResponse.json({
      ok: true,
      redirectTo: `/trips/${tripId}/step2/path`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
