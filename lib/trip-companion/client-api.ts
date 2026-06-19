import type { ItineraryData, TripBooking } from '@/lib/bookings/types'
import type { CompanionContext, TripCompanionOptions } from './types'

export function hotelFromBookings(bookings: TripBooking[]): string | null {
  const hotel = bookings.find(b => b.category === 'hotel' && b.location)
  return hotel?.location || bookings.find(b => b.category === 'hotel')?.location || null
}

export function buildCompanionContext(input: {
  trip: Record<string, unknown>
  bookings: TripBooking[]
  travelerNationalities: string[]
}): CompanionContext {
  const options = (input.trip.options || {}) as { itinerary?: ItineraryData }
  return {
    trip: {
      id: String(input.trip.id),
      name: String(input.trip.name || 'Trip'),
      destination: String(input.trip.destination || 'TBD'),
      start_date: String(input.trip.locked_date_start || input.trip.start_date || ''),
      end_date: String(input.trip.locked_date_end || input.trip.end_date || ''),
    },
    itinerary: options.itinerary || null,
    bookings: input.bookings,
    travelerNationalities: input.travelerNationalities,
    hotelAddress: hotelFromBookings(input.bookings),
  }
}

export function mergeCompanionOptions(
  existing: Record<string, unknown> | null | undefined,
  patch: Partial<TripCompanionOptions>
): Record<string, unknown> {
  const opts = existing || {}
  const companion = (opts.companion || {}) as TripCompanionOptions
  return {
    ...opts,
    companion: {
      ...companion,
      ...patch,
      briefings: patch.briefings
        ? { ...(companion.briefings || {}), ...patch.briefings }
        : companion.briefings,
    },
  }
}

export async function fetchInspirations(tripId: string) {
  const res = await fetch(`/api/inspiration/${tripId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load saves')
  return data.inspirations as Array<Record<string, unknown>>
}

export async function parseInspirationClient(body: {
  tripId: string
  url?: string
  caption?: string
  imageBase64?: string
  mimeType?: string
}) {
  const res = await fetch('/api/inspiration/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not parse')
  return data.parsed
}

export async function saveInspirationClient(tripId: string, parsed: Record<string, unknown>, meta: Record<string, unknown>) {
  const res = await fetch(`/api/inspiration/${tripId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed, ...meta }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not save')
  return data.inspiration
}

export async function generateEssentialsClient(tripId: string) {
  const res = await fetch(`/api/trip-companion/essentials/${tripId}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data.essentials
}

export async function generateAppsClient(tripId: string) {
  const res = await fetch(`/api/trip-companion/apps/${tripId}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data.country_apps
}

export async function generateBriefingClient(tripId: string, date: string, mode: 'evening' | 'morning' | 'both') {
  const res = await fetch(`/api/trip-companion/briefings/${tripId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, mode }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data.briefings
}
