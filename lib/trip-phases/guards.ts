import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTripPhasesPayload, getPhaseSnapshot, canEditPhase } from '@/lib/trip-phases/state'
import type { PhaseId } from '@/lib/trip-phases/types'

function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
}

/** Server-side guard before accepting submissions. */
export async function assertPhaseEditable(
  db: SupabaseClient,
  tripId: string,
  travelerId: string,
  userId: string,
  phaseId: PhaseId
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: trip } = await db.from('trips').select('*').eq('id', tripId).single()
  if (!trip) return { ok: false, error: 'Trip not found', status: 404 }

  const { data: traveler } = await db
    .from('travelers')
    .select('choices_submitted, round_one_submitted, round_two_submitted')
    .eq('id', travelerId)
    .single()

  const payload = buildTripPhasesPayload(
    trip,
    traveler,
    trip.organizer_id === userId,
    tripId
  )
  const phase = getPhaseSnapshot(payload, phaseId)
  if (!phase) return { ok: false, error: 'Unknown phase', status: 400 }
  if (!canEditPhase(phase.access)) {
    if (phase.access === 'not_opened') {
      return { ok: false, error: 'This phase is not open yet', status: 403 }
    }
    return { ok: false, error: 'This phase is closed — submissions are final', status: 403 }
  }

  if (phase.deadlineAt && isPast(phase.deadlineAt)) {
    return { ok: false, error: 'The submission window has closed', status: 403 }
  }

  return { ok: true }
}
