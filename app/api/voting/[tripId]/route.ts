import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import {
  allTravelersSubmittedRoundOne,
  applyRoundOneAdvancers,
  ensureVotingKickoff,
  ensureRoundTwoWinner,
  getChoicesSubmissionStatus,
  getRoundOneSubmissionStatus,
  getRoundTwoSubmissionStatus,
} from '@/lib/voting'
import { PLACEHOLDER_ROUND_TWO_PERSONAL } from '@/components/voting/DestinationCard'
import { generateRoundTwoPersonalContent } from '@/lib/voting/generate-content'

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
    let kickoffError: string | null = null
    let roundOneAdvanceError: string | null = null
    try {
      await ensureVotingKickoff(db, tripId)
    } catch (e) {
      kickoffError = e instanceof Error ? e.message : 'Failed to start voting'
    }

    const { data: trip } = await userClient
      .from('trips')
      .select('id, name, voting_round, total_cards, winning_destination_id, destination, max_votes')
      .eq('id', tripId)
      .single()

    if (trip?.voting_round === 1 && (await allTravelersSubmittedRoundOne(db, tripId))) {
      try {
        await applyRoundOneAdvancers(db, tripId)
        const { data: refreshedTrip } = await userClient
          .from('trips')
          .select('id, name, voting_round, total_cards, winning_destination_id, destination, max_votes')
          .eq('id', tripId)
          .single()
        if (refreshedTrip) Object.assign(trip, refreshedTrip)
      } catch (e) {
        roundOneAdvanceError = e instanceof Error ? e.message : 'Failed to advance to Round 2'
      }
    }

    if (trip?.voting_round === 2) {
      try {
        await ensureRoundTwoWinner(db, tripId)
        const { data: refreshedTrip } = await userClient
          .from('trips')
          .select('id, name, voting_round, total_cards, winning_destination_id, destination, max_votes')
          .eq('id', tripId)
          .single()
        if (refreshedTrip) Object.assign(trip, refreshedTrip)
      } catch {
        /* winner not ready yet */
      }
    }

    const submissionStatus = await getChoicesSubmissionStatus(
      db,
      tripId,
      trip?.max_votes ?? 2
    )

    const roundOneStatus =
      trip?.voting_round === 1 ? await getRoundOneSubmissionStatus(db, tripId) : undefined

    const roundTwoStatus =
      trip?.voting_round === 2 ? await getRoundTwoSubmissionStatus(db, tripId) : undefined

    const { data: destinations } = await userClient
      .from('destination_analysis')
      .select('*')
      .eq('trip_id', tripId)
      .eq('pushed_to_vote', true)
      .order('destination_name')

    const round = trip?.voting_round
    const roundOneDestinations = destinations || []
    const roundTwoDestinations = (destinations || []).filter(d => d.advanced_to_round_two)

    const filterIds = round === 2 ? roundTwoDestinations.map(d => d.id) : roundOneDestinations.map(d => d.id)

    const { data: myRoundOne } = filterIds.length
      ? await userClient
          .from('round_one_votes')
          .select('destination_analysis_id, rank')
          .eq('trip_id', tripId)
          .eq('traveler_id', traveler.id)
      : { data: [] }

    const { data: myRoundTwo } = filterIds.length
      ? await userClient
          .from('round_two_votes')
          .select('destination_analysis_id, percentage')
          .eq('trip_id', tripId)
          .eq('traveler_id', traveler.id)
      : { data: [] }

    const roundOneRanks: Record<string, number> = {}
    for (const v of myRoundOne || []) roundOneRanks[v.destination_analysis_id] = v.rank

    const roundTwoAllocations: Record<string, number> = {}
    for (const v of myRoundTwo || []) roundTwoAllocations[v.destination_analysis_id] = v.percentage

    const personalized: Record<string, unknown> = {}
    if (round === 2 && roundTwoDestinations.length) {
      for (const d of roundTwoDestinations) {
        const { data: existing } = await userClient
          .from('round_two_personalized_content')
          .select('content')
          .eq('trip_id', tripId)
          .eq('traveler_id', traveler.id)
          .eq('destination_analysis_id', d.id)
          .maybeSingle()

        if (existing?.content) {
          personalized[d.id] = existing.content
          continue
        }

        let content = PLACEHOLDER_ROUND_TWO_PERSONAL
        try {
          content = await generateRoundTwoPersonalContent({
            destinationName: d.destination_name,
            travelerPreferences: (traveler.step2 || {}) as Record<string, unknown>,
          })
          await db.from('round_two_personalized_content').upsert(
            {
              trip_id: tripId,
              traveler_id: traveler.id,
              destination_analysis_id: d.id,
              content,
            },
            { onConflict: 'trip_id,traveler_id,destination_analysis_id' }
          )
        } catch {
          /* placeholder */
        }
        personalized[d.id] = content
      }
    }

    const { data: travelerFull } = await userClient
      .from('travelers')
      .select('id, choices_submitted, round_one_submitted, round_two_submitted, step2')
      .eq('id', traveler.id)
      .single()

    return NextResponse.json({
      trip,
      submissionStatus,
      roundOneStatus,
      roundTwoStatus,
      kickoffError,
      roundOneAdvanceError,
      traveler: {
        id: traveler.id,
        choices_submitted: travelerFull?.choices_submitted ?? false,
        round_one_submitted: travelerFull?.round_one_submitted ?? false,
        round_two_submitted: travelerFull?.round_two_submitted ?? false,
      },
      roundOneDestinations,
      roundTwoDestinations,
      roundOneRanks,
      roundTwoAllocations,
      personalized,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
