import { supabase } from '@/lib/supabase'
import {
  buildStep2FromPreviewAnswers,
  clearPreviewTrip,
  loadPreviewTrip,
} from '@/lib/preview-trip-storage'

/** Attach homepage preview answers + generated cards to a newly created trip. */
export async function applyPreviewToTrip(tripId: string, userEmail: string): Promise<boolean> {
  const { answers, cards } = loadPreviewTrip()
  if (!answers?.q1) return false

  const step2 = buildStep2FromPreviewAnswers(answers)

  const { error: travelerError } = await supabase
    .from('travelers')
    .update({ step2 })
    .eq('trip_id', tripId)
    .eq('email', userEmail)

  if (travelerError) {
    console.error('applyPreviewToTrip traveler update:', travelerError)
    return false
  }

  if (Array.isArray(cards) && cards.length > 0) {
    const { error: destError } = await supabase.from('trip_destinations').upsert(
      {
        trip_id: tripId,
        cards,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trip_id' },
    )

    if (destError) {
      console.error('applyPreviewToTrip destinations upsert:', destError)
      return false
    }
  }

  clearPreviewTrip()
  return true
}
