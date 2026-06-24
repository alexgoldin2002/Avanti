import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoundOneTallyEntry, RoundTwoTallyEntry } from './types'
import {
  getVotingEligibleTravelers,
  travelerCanVoteInRound,
  travelerHasSubmittedChoices,
} from './kickoff'

/** Round 1 advancers: top 1/3 by lowest rank sum, floor 2, include ties at cutoff. */
export function calculateAdvancerCount(totalDestinations: number): number {
  if (totalDestinations <= 0) return 0
  return Math.max(2, Math.floor(totalDestinations / 3))
}

export async function getRoundOneTally(
  supabase: SupabaseClient,
  tripId: string
): Promise<RoundOneTallyEntry[]> {
  const { data: destinations } = await supabase
    .from('destination_analysis')
    .select('id, destination_name')
    .eq('trip_id', tripId)
    .eq('pushed_to_vote', true)

  if (!destinations?.length) return []

  const ids = destinations.map(d => d.id)
  const { data: votes } = await supabase
    .from('round_one_votes')
    .select('destination_analysis_id, rank')
    .eq('trip_id', tripId)
    .in('destination_analysis_id', ids)

  const sumByDest = new Map<string, number>()
  for (const d of destinations) sumByDest.set(d.id, 0)
  for (const v of votes || []) {
    sumByDest.set(
      v.destination_analysis_id,
      (sumByDest.get(v.destination_analysis_id) || 0) + (v.rank || 0)
    )
  }

  return destinations
    .map(d => ({
      destinationAnalysisId: d.id,
      destinationName: d.destination_name,
      rankSum: sumByDest.get(d.id) || 0,
    }))
    .sort((a, b) => a.rankSum - b.rankSum)
}

export async function getRoundOneSubmissionStatus(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ eligible: number; submitted: number; pendingNicknames: string[] }> {
  const { data: rows } = await supabase
    .from('travelers')
    .select('id, nickname, full_name, round_one_submitted, fills_own_preferences, can_vote')
    .eq('trip_id', tripId)

  const voters = (rows || []).filter(travelerCanVoteInRound)
  const pending = voters.filter(t => !t.round_one_submitted)
  return {
    eligible: voters.length,
    submitted: voters.length - pending.length,
    pendingNicknames: pending.map(t => {
      const row = t as { nickname?: string; full_name?: string }
      return row.nickname || row.full_name || 'A traveler'
    }),
  }
}

export async function calculateRoundOneAdvancers(
  supabase: SupabaseClient,
  tripId: string
): Promise<string[]> {
  const tally = await getRoundOneTally(supabase, tripId)
  if (!tally.length) return []

  const advancerCount = calculateAdvancerCount(tally.length)
  const cutoffIndex = advancerCount - 1
  const cutoffRankSum = tally[Math.min(cutoffIndex, tally.length - 1)]?.rankSum ?? Infinity

  return tally.filter(t => t.rankSum <= cutoffRankSum).map(t => t.destinationAnalysisId)
}

export async function applyRoundOneAdvancers(
  supabase: SupabaseClient,
  tripId: string
): Promise<string[]> {
  const advancerIds = await calculateRoundOneAdvancers(supabase, tripId)

  await supabase
    .from('destination_analysis')
    .update({ advanced_to_round_two: false })
    .eq('trip_id', tripId)

  if (advancerIds.length) {
    const { error } = await supabase
      .from('destination_analysis')
      .update({ advanced_to_round_two: true })
      .in('id', advancerIds)
    if (error) throw new Error(error.message)
  }

  const { error: tripErr } = await supabase.from('trips').update({ voting_round: 2 }).eq('id', tripId)
  if (tripErr) throw new Error(tripErr.message)

  return advancerIds
}

export async function getRoundTwoTally(
  supabase: SupabaseClient,
  tripId: string
): Promise<RoundTwoTallyEntry[]> {
  const { data: destinations } = await supabase
    .from('destination_analysis')
    .select('id, destination_name')
    .eq('trip_id', tripId)
    .eq('advanced_to_round_two', true)

  if (!destinations?.length) return []

  const ids = destinations.map(d => d.id)
  const { data: votes } = await supabase
    .from('round_two_votes')
    .select('destination_analysis_id, percentage')
    .eq('trip_id', tripId)
    .in('destination_analysis_id', ids)

  const sums = new Map<string, { total: number; count: number }>()
  for (const d of destinations) sums.set(d.id, { total: 0, count: 0 })
  for (const v of votes || []) {
    const cur = sums.get(v.destination_analysis_id)!
    cur.total += v.percentage
    cur.count += 1
  }

  const nameMap = new Map(destinations.map(d => [d.id, d.destination_name]))

  return [...sums.entries()]
    .map(([id, { total, count }]) => ({
      destinationAnalysisId: id,
      destinationName: nameMap.get(id) || '',
      averagePercentage: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
      voteCount: count,
    }))
    .sort((a, b) => b.averagePercentage - a.averagePercentage)
}

export async function getRoundTwoSubmissionStatus(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ eligible: number; submitted: number; pendingNicknames: string[] }> {
  const { data: rows } = await supabase
    .from('travelers')
    .select('id, nickname, full_name, round_two_submitted, fills_own_preferences, can_vote')
    .eq('trip_id', tripId)

  const voters = (rows || []).filter(travelerCanVoteInRound)
  const pending = voters.filter(t => !t.round_two_submitted)
  return {
    eligible: voters.length,
    submitted: voters.length - pending.length,
    pendingNicknames: pending.map(t => {
      const row = t as { nickname?: string; full_name?: string }
      return row.nickname || row.full_name || 'A traveler'
    }),
  }
}

export async function calculateRoundTwoWinner(
  supabase: SupabaseClient,
  tripId: string
): Promise<string | null> {
  const tally = await getRoundTwoTally(supabase, tripId)
  if (!tally.length) return null

  const topAvg = tally[0].averagePercentage
  const tied = tally.filter(t => t.averagePercentage === topAvg)
  if (tied.length === 1) return tied[0].destinationAnalysisId

  const roundOneTally = await getRoundOneTally(supabase, tripId)
  const rankSumMap = new Map(roundOneTally.map(t => [t.destinationAnalysisId, t.rankSum]))

  tied.sort(
    (a, b) =>
      (rankSumMap.get(a.destinationAnalysisId) || Infinity) -
      (rankSumMap.get(b.destinationAnalysisId) || Infinity)
  )
  return tied[0]?.destinationAnalysisId ?? null
}

export async function applyRoundTwoWinner(
  supabase: SupabaseClient,
  tripId: string
): Promise<string | null> {
  const winnerId = await calculateRoundTwoWinner(supabase, tripId)
  if (!winnerId) return null

  const { data: winner } = await supabase
    .from('destination_analysis')
    .select('destination_name')
    .eq('id', winnerId)
    .single()

  await supabase
    .from('trips')
    .update({
      winning_destination_id: winnerId,
      destination: winner?.destination_name || undefined,
    })
    .eq('id', tripId)

  return winnerId
}

export async function allTravelersSubmittedChoices(
  supabase: SupabaseClient,
  tripId: string
): Promise<boolean> {
  const { data: trip } = await supabase.from('trips').select('max_votes').eq('id', tripId).single()
  const maxVotes = trip?.max_votes ?? 2
  const eligible = await getVotingEligibleTravelers(supabase, tripId)
  return eligible.length > 0 && eligible.every(t => travelerHasSubmittedChoices(t, maxVotes))
}

export async function allTravelersSubmittedRoundOne(
  supabase: SupabaseClient,
  tripId: string
): Promise<boolean> {
  const status = await getRoundOneSubmissionStatus(supabase, tripId)
  return status.eligible > 0 && status.submitted === status.eligible
}

export async function allTravelersSubmittedRoundTwo(
  supabase: SupabaseClient,
  tripId: string
): Promise<boolean> {
  const status = await getRoundTwoSubmissionStatus(supabase, tripId)
  return status.eligible > 0 && status.submitted === status.eligible
}

export async function applyDestinationOverride(
  supabase: SupabaseClient,
  tripId: string,
  opts: { destinationAnalysisId?: string; destinationName?: string }
): Promise<void> {
  if (opts.destinationAnalysisId) {
    const { data: dest } = await supabase
      .from('destination_analysis')
      .select('destination_name')
      .eq('id', opts.destinationAnalysisId)
      .eq('trip_id', tripId)
      .single()
    if (!dest) throw new Error('Destination not found')

    const { error } = await supabase
      .from('trips')
      .update({
        winning_destination_id: opts.destinationAnalysisId,
        destination: dest.destination_name,
      })
      .eq('id', tripId)
    if (error) throw new Error(error.message)
    return
  }

  const name = opts.destinationName?.trim()
  if (!name) throw new Error('Destination name required')

  const { error } = await supabase
    .from('trips')
    .update({
      winning_destination_id: null,
      destination: name,
    })
    .eq('id', tripId)
  if (error) throw new Error(error.message)
}

export async function ensureRoundTwoWinner(
  supabase: SupabaseClient,
  tripId: string
): Promise<string | null> {
  const { data: trip } = await supabase
    .from('trips')
    .select('winning_destination_id, voting_round')
    .eq('id', tripId)
    .single()

  if (trip?.winning_destination_id) return trip.winning_destination_id
  if (trip?.voting_round !== 2) return null
  if (!(await allTravelersSubmittedRoundTwo(supabase, tripId))) return null

  return applyRoundTwoWinner(supabase, tripId)
}
