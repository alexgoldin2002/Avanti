import { supabase } from '@/lib/supabase'
import type { ActivityOffer } from '@/lib/getyourguide/search-tours'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export type ActivitiesSearchResponse = {
  configured: boolean
  offers: ActivityOffer[]
  error?: string
  fallbackSearchUrl?: string
  destination?: string
  startDate?: string | null
  endDate?: string | null
}

export async function fetchLiveActivities(tripId: string): Promise<ActivitiesSearchResponse> {
  const res = await fetch(`/api/activities/${tripId}/search`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to search activities')
  return data
}
