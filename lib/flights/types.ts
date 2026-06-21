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
}

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
