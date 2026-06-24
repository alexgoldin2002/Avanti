import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyRoundOneAdvancers,
  ensureRoundTwoWinner,
} from '@/lib/voting/tally'
import { ensureVotingKickoff } from '@/lib/voting/kickoff'
import {
  DEFAULT_BRAINSTORM_MINUTES,
  DEFAULT_ROUND_ONE_MINUTES,
  DEFAULT_ROUND_TWO_MINUTES,
  type TripPhaseFields,
} from './types'
import { deadlineFromOpened } from './state'

function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
}

export function openBrainstormTimestamps(trip: TripPhaseFields, now = new Date()): Record<string, string | number> {
  const opened = now.toISOString()
  const duration = trip.brainstorm_duration_minutes ?? DEFAULT_BRAINSTORM_MINUTES
  return {
    invites_closed: true,
    brainstorm_opened_at: opened,
    brainstorm_deadline_at: deadlineFromOpened(opened, duration),
    updated_at: opened,
  }
}

export function openVotingTimestamps(trip: TripPhaseFields, now = new Date()): Record<string, string | number> {
  const opened = now.toISOString()
  const duration = trip.round_one_duration_minutes ?? DEFAULT_ROUND_ONE_MINUTES
  return {
    voting_opened_at: opened,
    round_one_deadline_at: deadlineFromOpened(opened, duration),
    updated_at: opened,
  }
}

export function openRoundTwoTimestamps(trip: TripPhaseFields, now = new Date()): Record<string, string | number> {
  const opened = now.toISOString()
  const duration = trip.round_two_duration_minutes ?? DEFAULT_ROUND_TWO_MINUTES
  return {
    round_two_opened_at: opened,
    round_two_deadline_at: deadlineFromOpened(opened, duration),
    updated_at: opened,
  }
}

/** Close expired phases and advance the trip. Safe to call on every GET. */
export async function finalizeExpiredPhases(
  db: SupabaseClient,
  tripId: string
): Promise<void> {
  const { data: trip, error } = await db
    .from('trips')
    .select(
      'id, voting_round, winning_destination_id, destination, total_cards, ' +
        'brainstorm_deadline_at, brainstorm_closed_at, ' +
        'round_one_deadline_at, round_one_closed_at, ' +
        'round_two_deadline_at, round_two_closed_at, ' +
        'brainstorm_duration_minutes, round_one_duration_minutes, round_two_duration_minutes, ' +
        'voting_opened_at, round_two_opened_at'
    )
    .eq('id', tripId)
    .single()

  if (error || !trip) return

  const now = new Date().toISOString()

  // Brainstorm expired → close and try kickoff
  if (
    !trip.brainstorm_closed_at &&
    trip.brainstorm_deadline_at &&
    isPast(trip.brainstorm_deadline_at)
  ) {
    await db
      .from('trips')
      .update({ brainstorm_closed_at: now, updated_at: now })
      .eq('id', tripId)

    if (trip.voting_round == null) {
      try {
        await ensureVotingKickoff(db, tripId)
      } catch {
        /* not everyone ready — host can override open voting */
      }
    }
  }

  const { data: refreshed } = await db
    .from('trips')
    .select(
      'id, voting_round, winning_destination_id, destination, ' +
        'round_one_deadline_at, round_one_closed_at, round_two_opened_at, ' +
        'round_two_deadline_at, round_two_closed_at, round_two_duration_minutes'
    )
    .eq('id', tripId)
    .single()

  if (!refreshed) return

  // Round 1 expired → close and advance to Round 2
  if (
    refreshed.voting_round === 1 &&
    !refreshed.round_one_closed_at &&
    refreshed.round_one_deadline_at &&
    isPast(refreshed.round_one_deadline_at)
  ) {
    await db
      .from('trips')
      .update({ round_one_closed_at: now, updated_at: now })
      .eq('id', tripId)

    try {
      await applyRoundOneAdvancers(db, tripId)
      const roundTwoFields = openRoundTwoTimestamps(refreshed as TripPhaseFields, new Date())
      await db.from('trips').update(roundTwoFields).eq('id', tripId)
    } catch {
      /* partial votes — advance with who voted */
    }
  }

  const { data: afterR1 } = await db
    .from('trips')
    .select(
      'id, voting_round, winning_destination_id, destination, ' +
        'round_two_deadline_at, round_two_closed_at, round_two_opened_at'
    )
    .eq('id', tripId)
    .single()

  if (!afterR1) return

  // Round 2 expired → close and pick winner
  if (
    afterR1.voting_round === 2 &&
    !afterR1.round_two_closed_at &&
    afterR1.round_two_deadline_at &&
    isPast(afterR1.round_two_deadline_at)
  ) {
    await db
      .from('trips')
      .update({ round_two_closed_at: now, updated_at: now })
      .eq('id', tripId)

    try {
      await ensureRoundTwoWinner(db, tripId)
    } catch {
      /* winner not ready */
    }
  }
}

export async function extendPhaseDeadline(
  db: SupabaseClient,
  tripId: string,
  phase: 'brainstorm' | 'round_one' | 'round_two',
  extraMinutes: number
): Promise<string | null> {
  const { data: trip } = await db
    .from('trips')
    .select(
      'brainstorm_deadline_at, round_one_deadline_at, round_two_deadline_at, ' +
        'brainstorm_closed_at, round_one_closed_at, round_two_closed_at'
    )
    .eq('id', tripId)
    .single()

  if (!trip) throw new Error('Trip not found')

  const fieldMap = {
    brainstorm: { deadline: 'brainstorm_deadline_at', closed: 'brainstorm_closed_at' },
    round_one: { deadline: 'round_one_deadline_at', closed: 'round_one_closed_at' },
    round_two: { deadline: 'round_two_deadline_at', closed: 'round_two_closed_at' },
  } as const

  const { deadline, closed } = fieldMap[phase]
  const current = trip[deadline] as string | null
  if (!current) throw new Error('Phase is not open yet')

  const base = new Date(current).getTime()
  const newDeadline = new Date(base + extraMinutes * 60_000).toISOString()

  const patch: Record<string, string | null> = {
    [deadline]: newDeadline,
    updated_at: new Date().toISOString(),
  }
  if (trip[closed]) patch[closed] = null

  const { error } = await db.from('trips').update(patch).eq('id', tripId)
  if (error) throw new Error(error.message)
  return newDeadline
}
