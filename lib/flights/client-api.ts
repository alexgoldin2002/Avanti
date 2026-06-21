import type {
  CoordinationMode,
  DirectPreference,
  CostVsTime,
  FlightAnalysis,
  FlightSessionStatus,
  MemberFlightPrefs,
} from './types'

export async function fetchFlightSession(tripId: string) {
  const res = await fetch(`/api/flights/${tripId}`)
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load flights')
  return res.json()
}

export async function setCoordination(
  tripId: string,
  mode: CoordinationMode,
  mixNotes?: string
) {
  const res = await fetch(`/api/flights/${tripId}/coordination`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, mixNotes }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json()
}

export async function saveFlightPreferences(
  tripId: string,
  prefs: Partial<MemberFlightPrefs> & { wantsGroupRouting?: boolean | null }
) {
  const res = await fetch(`/api/flights/${tripId}/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json()
}

export async function runFlightAnalysis(tripId: string): Promise<{ analysis: FlightAnalysis }> {
  const res = await fetch(`/api/flights/${tripId}/analyze`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed')
  return res.json()
}

export async function lockFlights(tripId: string, scenarioId: string) {
  const res = await fetch(`/api/flights/${tripId}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Lock failed')
  return res.json()
}

export function formatCost(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export type FlightSessionResponse = {
  session: {
    id: string
    status: FlightSessionStatus
    coordination_mode: CoordinationMode | null
    mix_notes: string | null
    analysis: FlightAnalysis | null
    selected_scenario_id: string | null
    vote_estimate_per_person: number | null
    locked_at: string | null
    locked_summary: unknown
  } | null
  trip: Record<string, unknown>
  travelers: Array<Record<string, unknown>>
  travelerContexts: Array<{
    id: string
    name: string
    departure_city: string
    credit_cards: string[]
    airlines: Array<{ airline: string; tier: string }>
    card_perks_summary: string[]
    status_perks_summary: string[]
  }>
  prefs: Array<MemberFlightPrefs & { traveler_id: string; wants_group_routing: boolean | null }>
  myPrefs: (MemberFlightPrefs & { traveler_id: string }) | null
  isOrganizer: boolean
  myTravelerId: string | null
  voteEstimate: number | null
}

export type PrefsFormState = {
  direct_preference: DirectPreference
  preferred_airlines: string[]
  avoid_airlines: string
  cost_vs_time: CostVsTime
  wants_group_routing: boolean | null
  notes: string
}
