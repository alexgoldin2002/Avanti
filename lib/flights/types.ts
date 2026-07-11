export type CoordinationMode = 'together' | 'independent' | 'mix'

export type FlightSessionStatus = 'setup' | 'preferences' | 'analyzing' | 'review' | 'locked'

export type DirectPreference = 'nonstop_only' | 'one_stop_ok' | 'any_stops' | 'cheapest'

export type CostVsTime = 'cost' | 'balance' | 'time'

export type FlightType = 'nonstop' | 'one_stop' | 'multi_stop'

export type DayImpact = 'full_day' | 'afternoon_ok' | 'late_night' | 'lose_day' | 'early_departure'

export type MeetupWhere = 'hub' | 'destination' | 'before'

export type MemberFlightPrefs = {
  direct_preference: DirectPreference
  preferred_airlines: string[]
  avoid_airlines: string[]
  cost_vs_time: CostVsTime
  wants_group_routing: boolean | null
  notes?: string | null
}

export type LegTiming = {
  depart_local: string
  arrive_local: string
  arrival_vs_checkin: DayImpact
  day_impact: string
}

export type GroundTransportOption = {
  mode: 'train' | 'taxi' | 'rideshare' | 'bus'
  duration_min: number
  cost_usd: number
  notes: string
}

export type LoyaltyEarning = {
  program: string
  miles_or_points: number
  note?: string | null
}

export type HiddenFeeBreakdown = {
  advertised_usd: number
  bags_usd: number
  seat_selection_usd: number
  other_usd: number
  real_total_usd: number
  note?: string | null
}

export type MemberFlightPlan = {
  traveler_id: string
  traveler_name: string
  departure_city: string
  airline: string
  flight_type: FlightType
  duration_hours: number
  segments: Array<{ from: string; to: string; airline: string; duration_hours: number }>
  price_usd: number
  bags_included: string
  status_perks_used: string[]
  card_perks_used: string[]
  outbound: LegTiming
  return_leg: LegTiming
  ground_transport: GroundTransportOption[]
  meets_group: 'at_destination' | 'hub_en_route' | 'independent' | 'before_trip'
  // Travel-agent extras (optional — older analyses won't have them)
  seat_match?: string | null
  loyalty_earning?: LoyaltyEarning | null
  hidden_fees?: HiddenFeeBreakdown | null
  rule_flags?: string[]
}

export type AirportOption = {
  airport: string
  drive_or_transit: string
  est_total_usd: number | null
  note: string
}

export type GroupSyncAnalysis = {
  first_arrival: string
  last_arrival: string
  spread_hours: number
  meetup_options: Array<{ where: MeetupWhere; city: string; note: string }>
  everyone_same_day: boolean
}

export type FlightScenario = {
  id: string
  label: string
  departure_date: string
  return_date: string
  total_group_cost_usd: number
  avg_per_person_usd: number
  cost_vs_vote_estimate_pct: number | null
  cost_vs_time_label: string
  recommended: boolean
  group_size_note: string | null
  solo_vs_group_delta_usd: number | null
  cheapest_date_window: {
    leave: string
    return: string
    savings_vs_peak_usd: number
    note: string
  } | null
  routing_order_note: string | null
  member_plans: MemberFlightPlan[]
  group_sync: GroupSyncAnalysis
  // Travel-agent extras (optional)
  pros?: string[]
  cons?: string[]
  best_time_to_book?: string | null
  airport_options?: AirportOption[]
}

// ── Google-Flights-style flat option list ────────────────────────────────
export type FlightBadge = 'best' | 'cheapest' | 'fastest'

/** Per-traveler price/origin split for a group option (different home airports). */
export type FlightOptionMember = {
  traveler_id: string
  traveler_name: string
  origin: string
  price_usd: number
  note?: string | null
}

/**
 * One row in the results list, modeled on how Google Flights presents a fare:
 * airline(s), depart/arrive times, duration, stops, price, emissions.
 */
export type FlightOption = {
  id: string
  airlines: string[]              // display names, e.g. ["SAS"] or ["Air Canada","United"]
  operated_by?: string | null     // "Operated by SAS Connect"
  origin: string                  // IATA, e.g. "ORD"
  destination: string             // IATA, e.g. "LIS"
  departure_date: string          // YYYY-MM-DD
  return_date: string             // YYYY-MM-DD
  depart_time: string             // "7:15 PM" (local, outbound)
  arrive_time: string             // "11:15 PM" (local, outbound)
  arrive_plus_days: number        // e.g. 1 for "+1"
  duration_hours: number
  duration_label: string          // "22 hr", "11 hr 30 min"
  stops: number                   // 0 = nonstop
  stops_label: string             // "Nonstop" | "1 stop"
  layover_detail?: string | null  // "9h 35m CPH"
  self_transfer?: boolean         // separate-ticket / unprotected connection
  price_usd: number               // per person, round trip
  price_label: string             // "round trip"
  co2_kg?: number | null
  co2_delta_pct?: number | null   // vs typical for route: +24 or -21
  cabin?: string | null
  bags_summary?: string | null
  seat_summary?: string | null
  badges: FlightBadge[]
  recommended: boolean
  pros: string[]
  cons: string[]
  member_breakdown?: FlightOptionMember[]
}

export type FareSource = 'live' | 'estimate' | 'mixed'

export type FlightAnalysis = {
  generated_at: string
  coordination_mode: CoordinationMode
  destination: string
  destination_airport: string
  date_range: { start: string; end: string }
  vote_estimate_per_person: number | null
  price_drift_warning: string | null
  scenarios: FlightScenario[]
  summary: string
  // Google-Flights-style list (primary UI). Older analyses may not have it.
  flight_options?: FlightOption[]
  recommended_dates?: { departure_date: string; return_date: string; why: string } | null
  // Travel-agent extras (optional)
  booking_reminder?: string | null
  data_disclaimer?: string | null
  travel_hacks?: string[]
  /** Whether prices came from live APIs (Duffel and/or Google via Bright Data) or AI estimates */
  fare_source?: FareSource
  /** Which live providers contributed to this analysis */
  live_sources?: { duffel?: boolean; google?: boolean }
}

/** Client-side filter state, modeled on the Google Flights filter chips. */
export type FlightSortKey = 'best' | 'price' | 'duration' | 'depart'

export type FlightFilterState = {
  stops: 'any' | 'nonstop' | 'one_or_fewer'
  airlines: string[]            // include-only; empty = all
  maxPriceUsd: number | null
  departWindow: 'any' | 'morning' | 'afternoon' | 'evening' | 'redeye'
  maxDurationHours: number | null
  sort: FlightSortKey
}

export const EMPTY_FLIGHT_FILTERS: FlightFilterState = {
  stops: 'any',
  airlines: [],
  maxPriceUsd: null,
  departWindow: 'any',
  maxDurationHours: null,
  sort: 'best',
}

export const DEPART_WINDOW_LABELS: Record<FlightFilterState['departWindow'], string> = {
  any: 'Any time',
  morning: 'Morning (5a–12p)',
  afternoon: 'Afternoon (12p–6p)',
  evening: 'Evening (6p–12a)',
  redeye: 'Red-eye (12a–5a)',
}

export const FLIGHT_SORT_LABELS: Record<FlightSortKey, string> = {
  best: 'Best',
  price: 'Price',
  duration: 'Duration',
  depart: 'Departure time',
}

export const DIRECT_PREF_LABELS: Record<DirectPreference, string> = {
  nonstop_only: 'Nonstop only',
  one_stop_ok: '1 stop OK',
  any_stops: 'Any stops — save money',
  cheapest: 'Cheapest, whatever it takes',
}

export const COST_VS_TIME_LABELS: Record<CostVsTime, string> = {
  cost: 'Lowest price',
  balance: 'Balance cost & time',
  time: 'Fastest / least hassle',
}

export const COORDINATION_LABELS: Record<CoordinationMode, string> = {
  together: 'Fly together as one group',
  independent: 'Meet at the destination independently',
  mix: 'Mix — some coordinate, some solo',
}

export const DRIFT_THRESHOLD = 0.15

export const GROUP_AIRLINE_CALL_THRESHOLD = 9
