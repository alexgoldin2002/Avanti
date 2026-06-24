import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import {
  ensureRoundTwoWinner,
  getRoundTwoSubmissionStatus,
  getRoundTwoTally,
} from '@/lib/voting'

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
    await ensureRoundTwoWinner(db, tripId)

    const { data: trip } = await userClient
      .from('trips')
      .select('id, name, destination, winning_destination_id, voting_round, organizer_id')
      .eq('id', tripId)
      .single()

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const { data: destinations } = await userClient
      .from('destination_analysis')
      .select('*')
      .eq('trip_id', tripId)
      .eq('pushed_to_vote', true)
      .order('destination_name')

    const allVotingCards = destinations || []
    const finalistOptions = allVotingCards.filter(d => d.advanced_to_round_two)
    const tally = await getRoundTwoTally(db, tripId)
    const roundTwoStatus = await getRoundTwoSubmissionStatus(db, tripId)

    let winner = null
    if (trip.winning_destination_id) {
      winner =
        allVotingCards.find(d => d.id === trip.winning_destination_id) ||
        (await userClient
          .from('destination_analysis')
          .select('*')
          .eq('id', trip.winning_destination_id)
          .maybeSingle()).data
    }

    const allSubmitted =
      roundTwoStatus.eligible > 0 && roundTwoStatus.submitted === roundTwoStatus.eligible
    const ready = allSubmitted && (!!trip.winning_destination_id || !!trip.destination)

    return NextResponse.json({
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        winning_destination_id: trip.winning_destination_id,
        voting_round: trip.voting_round,
      },
      tally,
      roundTwoStatus,
      winner,
      finalistOptions,
      allVotingCards,
      isOrganizer: trip.organizer_id === user.id,
      ready,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
