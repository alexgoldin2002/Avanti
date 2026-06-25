import {
  travelWindowFromTripOverlap,
  type TripGroupOverlapFields,
} from '@/lib/group-date-overlap/sync-trip-overlap'
import type { TravelWindow } from './types'

/** Climate and trip planning use the stored group max overlap from Step 2. */
export function resolveTripTravelWindow(input: {
  trip?: TripGroupOverlapFields | null
}): TravelWindow | null {
  return travelWindowFromTripOverlap(input.trip)
}
