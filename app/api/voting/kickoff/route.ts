import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { ensureVotingKickoff, getChoicesSubmissionStatus, getVotingEligibleTravelers, travelerHasSubmittedChoices } from '@/lib/voting/kickoff'
import { analyzeGroupDateOverlap, travelerProfilesFromRows } from '@/lib/group-date-overlap'

/** Force-sync brainstorm picks → destination_analysis and start voting if ready. */
export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    await requireOrganizer(userClient, tripId)
    const traveler = await findTravelerForUser(userClient, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? userClient

    const { data: travelers } = await userClient
      .from('travelers')
      .select('id, nickname, full_name, step2, fills_own_preferences')
      .eq('trip_id', tripId)
    const overlap = analyzeGroupDateOverlap(travelerProfilesFromRows(travelers || []))
    if (overlap.status === 'no_overlap' || overlap.status === 'too_short') {
      return NextResponse.json(
        { error: overlap.summary, dateOverlap: overlap },
        { status: 403 }
      )
    }

    const { data: trip } = await db.from('trips').select('max_votes').eq('id', tripId).single()
    const maxVotes = trip?.max_votes ?? 2
    const submissionStatus = await getChoicesSubmissionStatus(db, tripId, maxVotes)
    if (submissionStatus.submitted < submissionStatus.eligible || submissionStatus.eligible === 0) {
      return NextResponse.json(
        { error: 'Not everyone has submitted their card choices yet.' },
        { status: 400 }
      )
    }

    const eligible = await getVotingEligibleTravelers(db, tripId)
    if (!eligible.every(t => travelerHasSubmittedChoices(t, maxVotes))) {
      return NextResponse.json(
        { error: 'Not everyone has submitted their card choices yet.' },
        { status: 400 }
      )
    }

    const result = await ensureVotingKickoff(db, tripId, { force: true })

    if (!result) {
      return NextResponse.json(
        { error: 'No destinations were found from submitted choices — check that card choices were saved and try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
