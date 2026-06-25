import type { SupabaseClient } from '@supabase/supabase-js'
import {
  analyzeGroupDateOverlap,
  formatDateRange,
  travelerProfilesFromRows,
  type GroupDateOverlapResult,
} from '@/lib/group-date-overlap'
import type { TravelWindow } from '@/lib/weather/types'
import { normalizeIsoDate } from '@/lib/weather/normalize-date'

export type TripGroupOverlapFields = {
  group_overlap_start?: string | null
  group_overlap_end?: string | null
  group_overlap_nights?: number | null
  group_overlap_status?: GroupDateOverlapResult['status'] | string | null
  group_overlap_computed_at?: string | null
  start_date?: string | null
  end_date?: string | null
}

export function travelWindowFromTripOverlap(
  trip: TripGroupOverlapFields | null | undefined
): TravelWindow | null {
  const start =
    normalizeIsoDate(trip?.group_overlap_start) ||
    normalizeIsoDate(trip?.start_date)
  const end =
    normalizeIsoDate(trip?.group_overlap_end) ||
    normalizeIsoDate(trip?.end_date)
  if (!start || !end || end < start) return null
  return {
    start,
    end,
    label: formatDateRange(start, end),
  }
}

/** Recompute max group overlap from Step 2 and persist on the trip row. */
export async function syncTripGroupOverlap(
  db: SupabaseClient,
  tripId: string
): Promise<GroupDateOverlapResult> {
  const { data: rows, error: readErr } = await db
    .from('travelers')
    .select('id, nickname, full_name, step2, fills_own_preferences')
    .eq('trip_id', tripId)

  if (readErr) throw new Error(readErr.message)

  const result = analyzeGroupDateOverlap(travelerProfilesFromRows(rows || []))

  const hasOverlap = !!result.overlapStart && !!result.overlapEnd && result.overlapNights > 0

  const { error: updateErr } = await db
    .from('trips')
    .update({
      group_overlap_start: hasOverlap ? result.overlapStart : null,
      group_overlap_end: hasOverlap ? result.overlapEnd : null,
      group_overlap_nights: result.overlapNights,
      group_overlap_status: result.status,
      group_overlap_computed_at: new Date().toISOString(),
    })
    .eq('id', tripId)

  if (updateErr) throw new Error(updateErr.message)

  return result
}
