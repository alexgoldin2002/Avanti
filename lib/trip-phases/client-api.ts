import { supabase } from '@/lib/supabase'
import type { PhaseId, TripPhasesPayload } from './types'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}

export async function fetchTripPhases(tripId: string): Promise<TripPhasesPayload> {
  const res = await fetch(`/api/trips/${tripId}/phases`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load phase timers')
  return data as TripPhasesPayload
}

export async function openTripPhase(tripId: string, phase: PhaseId): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}/phases/open`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ phase }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to open phase')
}

export async function extendTripPhase(
  tripId: string,
  phase: 'brainstorm' | 'round_one' | 'round_two',
  extraMinutes: number
): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}/phases/extend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ phase, extraMinutes }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to extend time')
}

export async function savePhaseDurations(
  tripId: string,
  durations: {
    brainstormDurationMinutes?: number
    roundOneDurationMinutes?: number
    roundTwoDurationMinutes?: number
  }
): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}/phases`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(durations),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save durations')
}
