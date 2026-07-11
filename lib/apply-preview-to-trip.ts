import { supabase } from '@/lib/supabase'
import {
  buildStep2FromPreviewAnswers,
  clearPreviewTrip,
  loadPreviewTrip,
  type PreviewTripMeta,
} from '@/lib/preview-trip-storage'
import type { DestinationPlanningPath } from '@/lib/step2/planning-path'

/** Attach homepage preview answers + generated cards to a newly created trip. */
export async function applyPreviewToTrip(tripId: string, userEmail: string): Promise<boolean> {
  const { answers, cards, meta } = loadPreviewTrip()
  if (!answers?.q1) return false

  const step2 = buildStep2FromPreviewAnswers(answers, meta)

  if (Array.isArray(cards) && cards.length > 0) {
    step2.cards = cards
  }

  const planningPath = meta?.planningPath as DestinationPlanningPath | undefined
  const tripPatch: Record<string, unknown> = {}

  if (planningPath) {
    tripPatch.destination_planning_path = planningPath
  }

  if (planningPath === 'known' && meta?.knownDestination?.trim()) {
    tripPatch.destination = meta.knownDestination.trim()
    if (meta.knownDates?.mode === 'Fixed dates' && meta.knownDates.fixedDates.start && meta.knownDates.fixedDates.end) {
      tripPatch.date_type = 'exact'
      tripPatch.start_date = meta.knownDates.fixedDates.start
      tripPatch.end_date = meta.knownDates.fixedDates.end
      tripPatch.dates_locked = true
    } else if (meta.knownDates?.mode === 'Flexible — I have a range') {
      tripPatch.date_type = 'flexible'
      tripPatch.date_range_start = meta.knownDates.fixedDates.start
      tripPatch.date_range_end = meta.knownDates.fixedDates.end
    }
  }

  if (Object.keys(tripPatch).length > 0) {
    const { error: tripError } = await supabase
      .from('trips')
      .update(tripPatch)
      .eq('id', tripId)

    if (tripError) {
      console.error('applyPreviewToTrip trip update:', tripError)
      return false
    }
  }

  const { error: travelerError } = await supabase
    .from('travelers')
    .update({ step2 })
    .eq('trip_id', tripId)
    .eq('email', userEmail)

  if (travelerError) {
    console.error('applyPreviewToTrip traveler update:', travelerError)
    return false
  }

  clearPreviewTrip()
  return true
}

export type { PreviewTripMeta }
