import { extractIata } from '@/lib/booking/search-links'
import { getDuffelClient } from './client'

export type LiveFlightOffer = {
  id: string
  totalAmount: string
  totalCurrency: string
  airline: string
  duration: string
  stops: number
  departAt: string
  arriveAt: string
  /** Duffel payment link when available */
  bookUrl: string | null
}

export type LiveFlightSearchResult = {
  configured: boolean
  offers: LiveFlightOffer[]
  error?: string
}

function sliceStops(segments: Array<{ origin?: { iata_code?: string }; destination?: { iata_code?: string } }>): number {
  return Math.max(0, segments.length - 1)
}

export async function searchDuffelOffers(input: {
  origin: string
  destination: string
  departDate: string
  returnDate: string
  adults?: number
}): Promise<LiveFlightSearchResult> {
  const duffel = getDuffelClient()
  if (!duffel) {
    return { configured: false, offers: [] }
  }

  const origin = extractIata(input.origin) || input.origin.slice(0, 3).toUpperCase()
  const destination = extractIata(input.destination) || input.destination.slice(0, 3).toUpperCase()
  const adults = input.adults ?? 1

  try {
    const response = await duffel.offerRequests.create({
      slices: [
        { origin, destination, departure_date: input.departDate },
        { origin: destination, destination: origin, departure_date: input.returnDate },
      ],
      passengers: Array.from({ length: adults }, () => ({ type: 'adult' as const })),
      cabin_class: 'economy',
      return_offers: true,
    })

    const offers = (response.data.offers || []).slice(0, 8).map(offer => {
      const outbound = offer.slices[0]
      const segments = outbound?.segments || []
      const first = segments[0]
      const last = segments[segments.length - 1]
      const owner = offer.owner?.name || first?.marketing_carrier?.name || 'Airline'

      return {
        id: offer.id,
        totalAmount: offer.total_amount,
        totalCurrency: offer.total_currency,
        airline: owner,
        duration: outbound?.duration || '',
        stops: sliceStops(segments),
        departAt: first?.departing_at || '',
        arriveAt: last?.arriving_at || '',
        bookUrl: null,
      }
    })

    return { configured: true, offers }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Duffel search failed'
    return { configured: true, offers: [], error: msg }
  }
}
