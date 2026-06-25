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
import { resolveRoundTwoPersonalContent } from '@/lib/voting/personalized-content'
import { resolveRoundOneContent } from '@/lib/voting/round-one-content'
import { estimateDestinationPrice } from '@/lib/pricing/estimate-destination-price'
import type { DestinationPriceEstimate } from '@/lib/pricing/types'
import { resolveTripTravelWindow, getTypicalWeatherLine, debugTypicalWeather } from '@/lib/weather/climate-summary'
import { syncTripGroupOverlap } from '@/lib/group-date-overlap/sync-trip-overlap'
import { finalizeExpiredPhases } from '@/lib/trip-phases/finalize'
import { stampRoundTwoOpened } from '@/lib/trip-phases/stamp'

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
    let kickoffError: string | null = null
    let roundOneAdvanceError: string | null = null
    try {
      await ensureVotingKickoff(db, tripId)
    } catch (e) {
      kickoffError = e instanceof Error ? e.message : 'Failed to start voting'
    }

    const { data: trip } = await userClient
      .from('trips')
      .select(
        'id, name, voting_round, total_cards, winning_destination_id, destination, max_votes, start_date, end_date, group_overlap_start, group_overlap_end, group_overlap_nights, group_overlap_status, group_overlap_computed_at'
      )
      .eq('id', tripId)
      .single()

    let overlapSyncError: string | null = null
    try {
      await syncTripGroupOverlap(db, tripId)
      const { data: tripFresh } = await userClient
        .from('trips')
        .select(
          'id, name, voting_round, total_cards, winning_destination_id, destination, max_votes, start_date, end_date, group_overlap_start, group_overlap_end, group_overlap_nights, group_overlap_status, group_overlap_computed_at'
        )
        .eq('id', tripId)
        .single()
      if (tripFresh) Object.assign(trip ?? {}, tripFresh)
    } catch (e) {
      overlapSyncError = e instanceof Error ? e.message : 'Failed to sync group overlap'
    }

    if (trip?.voting_round === 1 && (await allTravelersSubmittedRoundOne(db, tripId))) {
      try {
        await applyRoundOneAdvancers(db, tripId)
        await stampRoundTwoOpened(db, tripId)
        const { data: refreshedTrip } = await userClient
          .from('trips')
          .select('id, name, voting_round, total_cards, winning_destination_id, destination, max_votes, start_date, end_date')
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
          .select('id, name, voting_round, total_cards, winning_destination_id, destination, max_votes, start_date, end_date')
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

    const { data: allTravelersForPricing } = await userClient
      .from('travelers')
      .select('id, nickname, full_name, step2')
      .eq('trip_id', tripId)

    const travelWindow = resolveTripTravelWindow({ trip })
    const weatherDebug: Awaited<ReturnType<typeof debugTypicalWeather>>[] = []

    const round = trip?.voting_round
    const rawDestinations = destinations || []
    const roundOneDestinations = await Promise.all(
      rawDestinations.map(async d => {
        const climateWeather = travelWindow
          ? await getTypicalWeatherLine(d.destination_name, travelWindow, d.country)
          : null

        if (process.env.NODE_ENV === 'development' && travelWindow) {
          weatherDebug.push(
            await debugTypicalWeather({
              destinationName: d.destination_name,
              countryHint: d.country,
              window: travelWindow,
            })
          )
        }

        const resolved = resolveRoundOneContent({
          roundOneContent: d.round_one_content,
          cardSnapshot: (d.card_snapshot || null) as Record<string, unknown> | null,
          destinationName: d.destination_name,
          climateWeather,
          hasTravelWindow: travelWindow != null,
        })

        let priceEstimate: DestinationPriceEstimate | null =
          (d.price_estimate as DestinationPriceEstimate | null) ?? null
        const computedAt = priceEstimate?.computedAt
        const stalePrice =
          !computedAt ||
          Date.now() - new Date(computedAt).getTime() > 6 * 60 * 60 * 1000

        if ((stalePrice || !priceEstimate) && round !== 2) {
          priceEstimate = await estimateDestinationPrice({
            destinationName: d.destination_name,
            country: d.country,
            travelWindow,
            travelers: allTravelersForPricing || [],
            cardSnapshot: (d.card_snapshot || null) as Record<string, unknown> | null,
            adults: allTravelersForPricing?.length || 1,
          })
        }

        void db
          .from('destination_analysis')
          .update({
            round_one_content: resolved,
            price_estimate: priceEstimate,
          })
          .eq('id', d.id)

        return { ...d, round_one_content: resolved, price_estimate: priceEstimate }
      })
    )
    const roundTwoDestinations = roundOneDestinations.filter(d => d.advanced_to_round_two)

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

    const { data: travelerFull } = await userClient
      .from('travelers')
      .select('id, choices_submitted, round_one_submitted, round_two_submitted, step2')
      .eq('id', traveler.id)
      .single()

    const step2 = (travelerFull?.step2 || traveler.step2 || {}) as Record<string, unknown>
    const travelDatesLabel =
      trip?.start_date && trip?.end_date
        ? `${trip.start_date} to ${trip.end_date}`
        : undefined

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

        personalized[d.id] = await resolveRoundTwoPersonalContent(db, {
          tripId,
          travelerId: traveler.id,
          destinationAnalysisId: d.id,
          destinationName: d.destination_name,
          cardSnapshot: (d.card_snapshot || null) as Record<string, unknown> | null,
          step2,
          travelDatesLabel,
          existingContent: existing?.content,
        })
      }
    }

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
      travelWindow,
      overlapSyncError,
      ...(process.env.NODE_ENV === 'development' ? { weatherDebug } : {}),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
