import { getLiteApiClient, isLiteApiConfigured } from './client'

export type LiveStayOffer = {
  hotelId: string
  name: string
  address: string | null
  stars: number | null
  rating: number | null
  minTotalUsd: number | null
  minPerNightUsd: number | null
  currency: string
  offerId: string | null
  roomName: string | null
  refundable: boolean | null
}

export type LiveStaySearchResult = {
  configured: boolean
  offers: LiveStayOffer[]
  error?: string
}

const TIER_HINT: Record<string, string> = {
  budget: 'budget-friendly 3-star hotels',
  mid: '4-star mid-range hotels',
  luxury: 'luxury 5-star hotels and boutique stays',
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  if (!a || !b || b <= a) return 1
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

function tierSearchQuery(destination: string, tier: string | null | undefined, adults: number): string {
  const hint = (tier && TIER_HINT[tier]) || 'hotels and well-rated stays'
  return `${hint} in ${destination} for ${adults} adult${adults === 1 ? '' : 's'}`
}

export async function searchLiveStays(input: {
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  tier?: string | null
  guestNationality?: string
}): Promise<LiveStaySearchResult> {
  if (!isLiteApiConfigured()) {
    return { configured: false, offers: [] }
  }

  const liteApi = getLiteApiClient()
  if (!liteApi) {
    return { configured: false, offers: [] }
  }

  const nights = nightsBetween(input.checkIn, input.checkOut)

  try {
    const result = await liteApi.getMinRates({
      checkin: input.checkIn,
      checkout: input.checkOut,
      currency: 'USD',
      guestNationality: input.guestNationality || 'US',
      occupancies: [{ rooms: 1, adults: Math.max(1, input.adults), children: [] }],
      aiSearch: tierSearchQuery(input.destination, input.tier, input.adults),
      limit: 12,
      timeout: 12,
    })

    if (result.status !== 'success') {
      const err = (result as { error?: { message?: string } }).error?.message || 'LiteAPI search failed'
      return { configured: true, offers: [], error: err }
    }

    const rows = (result.data as { data?: unknown[] })?.data || []
    const offers: LiveStayOffer[] = []

    for (const row of rows) {
      const hotel = row as Record<string, unknown>
      const hotelId = String(hotel.hotelId || '')
      if (!hotelId) continue

      const minRate = hotel.minRate as Record<string, unknown> | undefined
      const total = minRate?.total != null ? Number(minRate.total) : null
      const currency = String(minRate?.currency || 'USD')

      offers.push({
        hotelId,
        name: String(hotel.name || hotel.hotelName || 'Hotel'),
        address: hotel.address ? String(hotel.address) : null,
        stars: hotel.stars != null ? Number(hotel.stars) : null,
        rating: hotel.rating != null ? Number(hotel.rating) : null,
        minTotalUsd: total,
        minPerNightUsd: total != null ? Math.round(total / nights) : null,
        currency,
        offerId: minRate?.offerId ? String(minRate.offerId) : null,
        roomName: minRate?.roomName ? String(minRate.roomName) : null,
        refundable: typeof minRate?.refundable === 'boolean' ? minRate.refundable : null,
      })
    }

    return { configured: true, offers: offers.slice(0, 8) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LiteAPI search failed'
    return { configured: true, offers: [], error: msg }
  }
}
