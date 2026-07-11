/** Pre-filled external search URLs — bridge from Avanti planning to checkout sites. */

import {
  type AffiliateContext,
  wrapBookingComUrl,
  wrapExpediaUrl,
  wrapGetYourGuideUrl,
  wrapKayakUrl,
  wrapVrboUrl,
} from './affiliate'

export type { AffiliateContext }

export type FlightSearchParams = AffiliateContext & {
  origin: string
  destination: string
  departDate: string
  returnDate: string
}

export type HotelSearchParams = AffiliateContext & {
  destination: string
  checkIn: string
  checkOut: string
  /** Property or neighborhood name for tighter results */
  query?: string
  adults?: number
}

export type VrboSearchParams = HotelSearchParams

/** Pull a 3-letter IATA code from strings like "JFK · New York" or "LIS". */
export function extractIata(codeOrLabel: string): string | null {
  if (!codeOrLabel?.trim()) return null
  const upper = codeOrLabel.toUpperCase()
  const match = upper.match(/\b([A-Z]{3})\b/)
  return match?.[1] ?? null
}

function affiliateCtx(params: AffiliateContext): AffiliateContext {
  return { pubref: params.pubref, label: params.label }
}

/** Google Flights — no affiliate program; use kayakFlightsUrl when monetizing outbound clicks. */
export function googleFlightsUrl(params: FlightSearchParams): string {
  const q = `Flights from ${params.origin} to ${params.destination} on ${params.departDate} through ${params.returnDate}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
}

/** Google Hotels — no affiliate program; prefer bookingComUrl or expediaHotelsUrl. */
export function googleHotelsUrl(params: HotelSearchParams): string {
  const dest = params.destination.trim()
  const q = params.query?.trim() || `Hotels in ${dest}`
  const dates = `${params.checkIn},${params.checkOut}`
  return `https://www.google.com/travel/hotels/${encodeURIComponent(dest)}?q=${encodeURIComponent(q)}&dates=${dates}`
}

/** Booking.com — affiliate via aid when AFFILIATE_BOOKING_AID is set. */
export function bookingComUrl(params: HotelSearchParams): string {
  const ss = params.query?.trim() || params.destination.trim()
  const url = new URL('https://www.booking.com/searchresults.html')
  url.searchParams.set('ss', ss)
  url.searchParams.set('checkin', params.checkIn)
  url.searchParams.set('checkout', params.checkOut)
  if (params.adults && params.adults > 1) {
    url.searchParams.set('group_adults', String(params.adults))
  }
  return wrapBookingComUrl(url.toString(), affiliateCtx(params))
}

/** Expedia.com hotel search — affiliate via Partnerize when AFFILIATE_EXPEDIA_CAMREF is set. */
export function expediaHotelsUrl(params: HotelSearchParams): string {
  const url = new URL('https://www.expedia.com/Hotel-Search')
  url.searchParams.set('destination', params.query?.trim() || params.destination.trim())
  url.searchParams.set('startDate', params.checkIn)
  url.searchParams.set('endDate', params.checkOut)
  url.searchParams.set('adults', String(params.adults ?? 2))
  url.searchParams.set('rooms', '1')
  return wrapExpediaUrl(url.toString(), affiliateCtx(params))
}

/** Kayak flights — affiliate when AFFILIATE_KAYAK_PARTNER_ID is set. */
export function kayakFlightsUrl(params: FlightSearchParams): string {
  const url = new URL('https://www.kayak.com/flights')
  url.pathname = `/${encodeURIComponent(params.origin)}-${encodeURIComponent(params.destination)}/${params.departDate}/${params.returnDate}`
  return wrapKayakUrl(url.toString(), affiliateCtx(params))
}

/** Prefer monetized flight search when Kayak affiliate is configured. */
export function flightSearchUrl(params: FlightSearchParams): string {
  return kayakFlightsUrl(params)
}

/** Prefer monetized hotel search when Booking affiliate is configured. */
export function hotelSearchUrl(params: HotelSearchParams): string {
  return bookingComUrl(params)
}

/** VRBO / vacation rentals — Partnerize wrap when camref is set. */
export function vrboUrl(params: VrboSearchParams): string {
  const url = new URL('https://www.vrbo.com/search')
  const dest = params.query?.trim() || params.destination.trim()
  url.searchParams.set('destination', dest)
  url.searchParams.set('startDate', params.checkIn)
  url.searchParams.set('endDate', params.checkOut)
  url.searchParams.set('adults', String(params.adults ?? 2))
  if (params.query?.trim() && params.query.trim() !== params.destination.trim()) {
    url.searchParams.set('keywords', params.query.trim())
  }
  return wrapVrboUrl(url.toString(), affiliateCtx(params))
}

/** GetYourGuide search — partner_id when AFFILIATE_GETYOURGUIDE_PARTNER_ID is set. */
export function getYourGuideSearchUrl(destination: string, query?: string, ctx?: AffiliateContext): string {
  const q = query?.trim() || destination.trim()
  const url = new URL('https://www.getyourguide.com/s/')
  url.searchParams.set('q', q)
  return wrapGetYourGuideUrl(url.toString(), ctx)
}

/** Wrap a GYG tour URL from the Partner API with affiliate params if needed. */
export function getYourGuideTourUrl(tourUrl: string, ctx?: AffiliateContext): string {
  return wrapGetYourGuideUrl(tourUrl, ctx)
}

export type RestaurantSearchParams = {
  /** Restaurant name, when linking a specific suggestion. */
  name?: string
  /** City / destination for location context. */
  destination: string
  /** Reservation date YYYY-MM-DD. */
  date?: string
  /** 24h time HH:MM — defaults to 19:00. */
  time?: string
  partySize?: number
}

/**
 * OpenTable search — the only major reservation platform with a stable,
 * pre-fillable web search URL (no public API). Deep-links straight to a
 * bookable results page with party size and date/time when provided.
 */
export function openTableSearchUrl(params: RestaurantSearchParams): string {
  const term = [params.name?.trim(), params.destination?.trim()].filter(Boolean).join(' ')
  const url = new URL('https://www.opentable.com/s')
  if (term) url.searchParams.set('term', term)
  if (params.partySize && params.partySize > 0) {
    url.searchParams.set('covers', String(params.partySize))
  }
  if (params.date) {
    url.searchParams.set('dateTime', `${params.date}T${params.time || '19:00'}:00`)
  }
  return url.toString()
}

/**
 * Resy has no public search URL that reliably resolves an arbitrary venue, so
 * we route through a Resy-scoped Google query, which lands on the exact Resy
 * listing as the top result. (Resy's own booking API is partner-only.)
 */
export function resySearchUrl(params: RestaurantSearchParams): string {
  const q = [params.name?.trim(), params.destination?.trim(), 'site:resy.com']
    .filter(Boolean)
    .join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/**
 * Beli is a social restaurant-ranking app (discovery, not reservations) with no
 * web booking. This link helps users look a place up on Beli for reputation.
 */
export function beliSearchUrl(params: RestaurantSearchParams): string {
  const q = [params.name?.trim(), params.destination?.trim(), 'beli app']
    .filter(Boolean)
    .join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/** Airbnb has no public booking API — pre-filled search only (no affiliate program). */
export function airbnbUrl(params: HotelSearchParams): string {
  const dest = params.destination.trim().replace(/,/g, '').replace(/\s+/g, '-')
  const url = new URL(`https://www.airbnb.com/s/${encodeURIComponent(dest)}/homes`)
  url.searchParams.set('checkin', params.checkIn)
  url.searchParams.set('checkout', params.checkOut)
  url.searchParams.set('adults', String(params.adults ?? 2))
  url.searchParams.set('refinement_paths[]', '/homes')
  return url.toString()
}

export function isRentalStyleStay(type: string | undefined): boolean {
  if (!type) return false
  const t = type.toLowerCase()
  return (
    t.includes('vrbo') ||
    t.includes('villa') ||
    t.includes('vacation') ||
    t.includes('rental') ||
    t.includes('house') ||
    t.includes('cottage') ||
    t.includes('apartment') ||
    t.includes('condo')
  )
}

/** @deprecated Prefer isRentalStyleStay */
export function isAirbnbStyleStay(type: string | undefined): boolean {
  return isRentalStyleStay(type)
}

/** Best destination label for hotel search from trip + optional airport string. */
export function hotelDestinationFromTrip(destination: string, destinationAirport?: string | null): string {
  if (destination?.trim()) return destination.trim()
  if (destinationAirport?.trim()) {
    return destinationAirport.replace(/^[A-Z]{3}\s*[·\-–—]?\s*/i, '').trim() || destinationAirport
  }
  return 'destination'
}
