import { supabase } from '@/lib/supabase'
import type {
  MemberStayPrefs,
  StayAnalysis,
  StayCoordinationMode,
  StayOption,
  AccommodationSessionStatus,
} from './types'

async function authHeaders(json = false): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

export async function fetchAccommodationSession(tripId: string) {
  const res = await fetch(`/api/accommodation/${tripId}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load accommodation')
  return res.json()
}

export async function setStayCoordination(
  tripId: string,
  mode: StayCoordinationMode,
  mixNotes?: string
) {
  const res = await fetch(`/api/accommodation/${tripId}/coordination`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ mode, mixNotes }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json()
}

export async function saveStayPreferences(
  tripId: string,
  prefs: Partial<MemberStayPrefs>
) {
  const res = await fetch(`/api/accommodation/${tripId}/preferences`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed')
  return res.json()
}

export async function runStayAnalysis(tripId: string): Promise<{ analysis: StayAnalysis }> {
  const res = await fetch(`/api/accommodation/${tripId}/analyze`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed')
  return res.json()
}

export async function lockStay(tripId: string, optionId: string) {
  const res = await fetch(`/api/accommodation/${tripId}/lock`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ optionId }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Lock failed')
  return res.json()
}

export async function unlockStay(tripId: string) {
  const res = await fetch(`/api/accommodation/${tripId}/lock`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to reopen')
  return res.json()
}

export async function fetchStaySources(tripId: string) {
  const res = await fetch(`/api/accommodation/${tripId}/sources`, { headers: await authHeaders() })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load sources')
  return res.json()
}

export function formatCost(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export type AccommodationSessionResponse = {
  session: {
    id: string
    status: AccommodationSessionStatus
    coordination_mode: StayCoordinationMode | null
    mix_notes: string | null
    analysis: StayAnalysis | null
    selected_option_id: string | null
    vote_estimate_per_night: number | null
    locked_at: string | null
    locked_summary: StayOption | null
  } | null
  trip: Record<string, unknown>
  travelers: Array<Record<string, unknown>>
  travelerContexts: Array<{
    id: string
    name: string
    step2_accommodation: string | null
    step2_budget: string | null
  }>
  prefs: Array<MemberStayPrefs & { traveler_id: string }>
  myPrefs: (MemberStayPrefs & { traveler_id: string }) | null
  isOrganizer: boolean
  myTravelerId: string | null
  guestCount: number
  connectedSources: string[]
}
