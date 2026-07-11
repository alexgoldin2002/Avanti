export type StayCoordinationMode = 'together' | 'split' | 'mix'

export type AccommodationSessionStatus = 'setup' | 'preferences' | 'analyzing' | 'review' | 'locked'

export type StayType = 'hotel' | 'resort' | 'rental' | 'boutique' | 'any'

export type MemberStayPrefs = {
  stay_type: StayType
  private_room: boolean
  shared_space_ok: boolean
  max_budget_per_night: number | null
  neighborhood_notes: string | null
  amenities: string[]
  notes?: string | null
}

export type StayBadge = 'best' | 'cheapest' | 'group_fit' | 'top_rated'

export type StayBookLinks = {
  booking?: string
  expedia?: string
  vrbo?: string
  google?: string
  airbnb?: string
}

export type StayOption = {
  id: string
  name: string
  type: 'hotel' | 'resort' | 'rental' | 'boutique' | 'hostel' | 'apartment'
  area: string | null
  stars: number | null
  rating: number | null
  price_per_night_usd: number
  total_usd: number
  nights: number
  room_summary: string | null
  refundable: boolean | null
  group_fit: string
  pros: string[]
  cons: string[]
  badges: StayBadge[]
  recommended: boolean
  address: string | null
  source: 'liteapi' | 'estimate' | 'rental'
  hotel_id?: string | null
  offer_id?: string | null
  book_links: StayBookLinks
}

export type RateSource = 'live' | 'estimate' | 'mixed'

export type StayAnalysis = {
  generated_at: string
  coordination_mode: StayCoordinationMode
  destination: string
  date_range: { check_in: string; check_out: string }
  nights: number
  guest_count: number
  vote_estimate_per_night: number | null
  price_drift_warning: string | null
  summary: string
  stay_options: StayOption[]
  booking_reminder?: string | null
  data_disclaimer?: string | null
  stay_tips?: string[]
  rate_source?: RateSource
  live_sources?: {
    liteapi?: boolean
    booking_affiliate?: boolean
    expedia_affiliate?: boolean
    vrbo_affiliate?: boolean
    expedia_rapid?: boolean
  }
}

export const STAY_COORDINATION_LABELS: Record<StayCoordinationMode, string> = {
  together: 'One place for the whole group',
  split: 'Separate rooms — same area or building',
  mix: 'Mix — villa for some, hotel rooms for others',
}

export const STAY_TYPE_LABELS: Record<StayType, string> = {
  hotel: 'Hotel',
  resort: 'Resort',
  rental: 'Vacation rental / villa',
  boutique: 'Boutique / guesthouse',
  any: 'No strong preference',
}

export const DRIFT_THRESHOLD = 0.15
