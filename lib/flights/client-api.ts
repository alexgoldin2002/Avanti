import { supabase } from '@/lib/supabase'
import type {
  CoordinationMode,
  DirectPreference,
  CostVsTime,
  FlightAnalysis,
  FlightOption,
  FlightScenario,
  FlightSessionStatus,
  MemberFlightPrefs,
} from './types'

// Attach the signed-in user's token so the API routes can authenticate under RLS
// (there is no service-role key in every environment to bypass it).
async function authHeaders(json = false): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

export async function fetchFlightSession(tripId: string) {
  const res = await fetch(`/api/flights/${tripId}`, { headers: await authHeaders() })
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
    headers: await authHeaders(true),
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
    headers: await authHeaders(true),
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json()
}

export type FlightRefinement = {
  stops?: 'any' | 'nonstop' | 'one_or_fewer'
  include_airlines?: string[]
  max_price_usd?: number | null
  depart_window?: string | null
  max_duration_hours?: number | null
  cabin?: string | null
  note?: string | null
}

export async function runFlightAnalysis(
  tripId: string,
  refine?: FlightRefinement,
): Promise<{ analysis: FlightAnalysis }> {
  const res = await fetch(`/api/flights/${tripId}/analyze`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ refine: refine || null }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed')
  return res.json()
}

export type FlightChatMessage = { role: 'user' | 'assistant'; content: string }

export async function chatFlights(
  tripId: string,
  messages: FlightChatMessage[],
  currentOptions: FlightOption[],
): Promise<{ reply: string; new_options: FlightOption[] }> {
  const res = await fetch(`/api/flights/${tripId}/chat`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ messages, currentOptions }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Chat failed')
  return res.json()
}

/** Lock a chosen Google-Flights-style option (preferred), or a legacy scenario id. */
export async function lockFlights(
  tripId: string,
  ref: { optionId?: string; scenarioId?: string },
) {
  const res = await fetch(`/api/flights/${tripId}/lock`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(ref),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Lock failed')
  return res.json()
}

/** Reopen flight selection — revert a locked session back to the results list. */
export async function unlockFlights(tripId: string) {
  const res = await fetch(`/api/flights/${tripId}/lock`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to reopen selection')
  return res.json()
}

export async function fetchUpgradeAdvice(tripId: string, optionId?: string) {
  const res = await fetch(`/api/flights/${tripId}/upgrade-advice`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ optionId }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json() as Promise<{ advice: import('./upgrade-advisor').UpgradeAdvice }>
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
    locked_summary: FlightScenario | null
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
    seat_preference?: string | null
    cabin_class?: string | null
    loyalty?: Array<{ airline: string; number: string | null; tier: string }>
  }>
  prefs: Array<MemberFlightPrefs & { traveler_id: string; wants_group_routing: boolean | null }>
  myPrefs: (MemberFlightPrefs & { traveler_id: string }) | null
  isOrganizer: boolean
  myTravelerId: string | null
  voteEstimate: number | null
  agentBrief?: AgentBrief
}

export type AgentBrief = {
  trip_summary: string[]
  travelers: Array<{ name: string; known: string[]; missing: string[] }>
  global_gaps: string[]
}

export type PrefsFormState = {
  direct_preference: DirectPreference
  preferred_airlines: string[]
  avoid_airlines: string
  cost_vs_time: CostVsTime
  wants_group_routing: boolean | null
  notes: string
}
