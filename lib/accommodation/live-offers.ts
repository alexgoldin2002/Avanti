import { searchLiveStays } from '@/lib/liteapi/search-stays'
import { isLiteApiConfigured } from '@/lib/liteapi/client'
import {
  airbnbUrl,
  bookingComUrl,
  expediaHotelsUrl,
  googleHotelsUrl,
  isRentalStyleStay,
  vrboUrl,
} from '@/lib/booking/search-links'
import {
  isBookingAffiliateConfigured,
  isExpediaAffiliateConfigured,
  isVrboAffiliateConfigured,
} from '@/lib/booking/affiliate'
import type { StayAnalysisInput } from './traveler-context'
import type { StayBadge, StayBookLinks, StayOption } from './types'

export type LiveStaySources = {
  liteapi: boolean
  booking_affiliate: boolean
  expedia_affiliate: boolean
  vrbo_affiliate: boolean
  expedia_rapid: boolean
}

export type LiveStaysFetchResult = {
  configured: boolean
  sources: LiveStaySources
  offers: StayOption[]
  error?: string
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  if (!a || !b || b <= a) return 1
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

function buildBookLinks(input: {
  tripId: string
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  query: string
  preferRental: boolean
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
    google: googleHotelsUrl({ destination: input.destination, checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, query: input.query }),
    airbnb: airbnbUrl(base),
  }
}

function inferStayType(name: string, roomName: string | null): StayOption['type'] {
  const text = `${name} ${roomName || ''}`.toLowerCase()
  if (text.includes('resort')) return 'resort'
  if (text.includes('boutique') || text.includes('guesthouse')) return 'boutique'
  if (isRentalStyleStay(text)) return 'rental'
  if (text.includes('hostel')) return 'hostel'
  if (text.includes('apartment') || text.includes('suite')) return 'apartment'
  return 'hotel'
}

function liveOfferToStayOption(
  offer: Awaited<ReturnType<typeof searchLiveStays>>['offers'][number],
  input: {
    tripId: string
    destination: string
    checkIn: string
    checkOut: string
    adults: number
    nights: number
    index: number
  }
): StayOption {
  const type = inferStayType(offer.name, offer.roomName)
  const perNight = offer.minPerNightUsd ?? (offer.minTotalUsd != null ? Math.round(offer.minTotalUsd / input.nights) : 0)
  const total = offer.minTotalUsd ?? perNight * input.nights
  const preferRental = type === 'rental' || type === 'apartment'

  return {
    id: `live-${offer.hotelId || input.index}`,
    name: offer.name,
    type,
    area: null,
    stars: offer.stars,
    rating: offer.rating,
    price_per_night_usd: perNight,
    total_usd: total,
    nights: input.nights,
    room_summary: offer.roomName,
    refundable: offer.refundable,
    group_fit: '',
    pros: [],
    cons: [],
    badges: [],
    recommended: false,
    address: offer.address,
    source: 'liteapi',
    hotel_id: offer.hotelId,
    offer_id: offer.offerId,
    book_links: buildBookLinks({
      tripId: input.tripId,
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      query: offer.name,
      preferRental,
    }),
  }
}

export function assignStayBadges(options: StayOption[]): StayOption[] {
  if (options.length === 0) return options

  const sortedByPrice = [...options].sort((a, b) => a.price_per_night_usd - b.price_per_night_usd)
  const sortedByRating = [...options].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  const cheapest = sortedByPrice[0]
  const topRated = sortedByRating.find(o => (o.rating ?? 0) >= 8) || sortedByRating[0]
  const best = options.find(o => o.recommended) || sortedByPrice[Math.min(1, sortedByPrice.length - 1)] || options[0]

  return options.map(o => {
    const badges: StayBadge[] = [...o.badges]
    if (o.id === best?.id && !badges.includes('best')) badges.push('best')
    if (o.id === cheapest?.id && !badges.includes('cheapest')) badges.push('cheapest')
    if (o.id === topRated?.id && (o.rating ?? 0) >= 8 && !badges.includes('top_rated')) badges.push('top_rated')
    return { ...o, badges, recommended: o.id === best?.id || o.recommended }
  })
}

export async function fetchLiveStaysForAnalysis(
  input: StayAnalysisInput
): Promise<LiveStaysFetchResult> {
  const checkIn =
    input.trip.locked_date_start ||
    input.trip.start_date ||
    ''
  const checkOut =
    input.trip.locked_date_end ||
    input.trip.end_date ||
    ''

  const rapidConfigured = Boolean(
    process.env.EXPEDIA_RAPID_API_KEY?.trim() && process.env.EXPEDIA_RAPID_API_SECRET?.trim()
  )

  const sources: LiveStaySources = {
    liteapi: isLiteApiConfigured(),
    booking_affiliate: isBookingAffiliateConfigured(),
    expedia_affiliate: isExpediaAffiliateConfigured(),
    vrbo_affiliate: isVrboAffiliateConfigured(),
    expedia_rapid: rapidConfigured,
  }

  if (!checkIn || !checkOut) {
    return { configured: false, sources, offers: [], error: 'Missing check-in/check-out dates' }
  }

  const nights = nightsBetween(checkIn, checkOut)
  const adults = Math.max(1, input.guest_count)

  if (!sources.liteapi) {
    return { configured: false, sources, offers: [] }
  }

  const live = await searchLiveStays({
    destination: input.trip.destination,
    checkIn,
    checkOut,
    adults,
    tier: input.trip.locked_tier,
  })

  const offers = live.offers.map((offer, index) =>
    liveOfferToStayOption(offer, {
      tripId: input.trip_id,
      destination: input.trip.destination,
      checkIn,
      checkOut,
      adults,
      nights,
      index,
    })
  )

  return {
    configured: live.configured,
    sources,
    offers: assignStayBadges(offers.slice(0, 10)),
    error: live.error,
  }
}

export function getConnectedSourcesSummary(sources: LiveStaySources): string[] {
  const lines: string[] = []
  if (sources.liteapi) lines.push('LiteAPI — live hotel rates')
  if (sources.booking_affiliate) lines.push('Booking.com — affiliate search')
  if (sources.expedia_affiliate) lines.push('Expedia — affiliate search')
  if (sources.vrbo_affiliate) lines.push('VRBO — vacation rentals')
  if (sources.expedia_rapid) lines.push('Expedia Rapid — VRBO inventory (checkout coming)')
  lines.push('Google Hotels — price comparison (no commission)')
  lines.push('Airbnb — rental search (no API)')
  return lines
}
