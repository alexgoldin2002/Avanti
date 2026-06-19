import type { ItineraryData, TripBooking } from '@/lib/bookings/types'
import { mergeBookingsIntoItinerary } from '@/lib/bookings/merge-itinerary'
import {
  mergeInspirationsIntoItinerary,
  type TripInspirationRow,
} from '@/lib/trip-companion/merge-inspirations'

export function mergeFullItinerary(
  base: ItineraryData,
  bookings: TripBooking[],
  inspirations: TripInspirationRow[] = []
): ItineraryData {
  return mergeInspirationsIntoItinerary(
    mergeBookingsIntoItinerary(base, bookings),
    inspirations
  )
}
