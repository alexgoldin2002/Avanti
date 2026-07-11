import {
  airbnbUrl,
  bookingComUrl,
  expediaHotelsUrl,
  googleHotelsUrl,
  vrboUrl,
} from '@/lib/booking/search-links'
import type { StayBookLinks, StayOption } from './types'

export function buildBookLinksForStay(input: {
  tripId: string
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  query: string
}): StayBookLinks {
  const ctx = { pubref: input.tripId, label: 'accommodation' }
  const base = {
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    query: input.query,
    ...ctx,
  }
  return {
    booking: bookingComUrl(base),
    expedia: expediaHotelsUrl(base),
    vrbo: vrboUrl(base),
    google: googleHotelsUrl({
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      query: input.query,
    }),
    airbnb: airbnbUrl(base),
  }
}

export function ensureStayBookLinks(
  options: StayOption[],
  input: {
    tripId: string
    destination: string
    checkIn: string
    checkOut: string
    adults: number
  }
): StayOption[] {
  return options.map(o => {
    const hasLinks = o.book_links?.booking && !o.book_links.booking.includes('/book')
    if (hasLinks) return o
    return {
      ...o,
      book_links: buildBookLinksForStay({
        ...input,
        query: [o.name, o.area].filter(Boolean).join(' '),
      }),
    }
  })
}
