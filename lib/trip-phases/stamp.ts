import type { SupabaseClient } from '@supabase/supabase-js'
import { openRoundTwoTimestamps, openVotingTimestamps } from './finalize'
import type { TripPhaseFields } from './types'

/** Set Round 1 voting window when kickoff starts. */
export async function stampVotingOpened(
  db: SupabaseClient,
  tripId: string,
  votingRound: number
): Promise<void> {
  const { data: trip } = await db.from('trips').select('*').eq('id', tripId).single()
  if (!trip) return

  const now = new Date()
  const patch: Record<string, string> = { updated_at: now.toISOString() }

  if (!trip.voting_opened_at) {
    Object.assign(patch, openVotingTimestamps(trip as TripPhaseFields, now))
  }

  if (votingRound === 2 && !trip.round_two_opened_at) {
    Object.assign(patch, openRoundTwoTimestamps(trip as TripPhaseFields, now))
    if (!trip.round_one_closed_at) {
      patch.round_one_closed_at = now.toISOString()
    }
  }

  if (Object.keys(patch).length > 1) {
    await db.from('trips').update(patch).eq('id', tripId)
  }
}

/** Start Round 2 window when everyone finishes Round 1. */
export async function stampRoundTwoOpened(db: SupabaseClient, tripId: string): Promise<void> {
  const { data: trip } = await db.from('trips').select('*').eq('id', tripId).single()
  if (!trip || trip.round_two_opened_at) return

  const now = new Date()
  await db
    .from('trips')
    .update({
      ...openRoundTwoTimestamps(trip as TripPhaseFields, now),
      round_one_closed_at: trip.round_one_closed_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', tripId)
}
