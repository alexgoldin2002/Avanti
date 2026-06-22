import { supabase } from '@/lib/supabase'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export type RentalSearchLinks = {
  vrbo: string
  google: string
  booking: string
  expedia: string
}

export type RentalSearchResponse = {
  configured: boolean
  affiliateConfigured: boolean
  searchLinks: RentalSearchLinks
  checkIn: string
  checkOut: string
  adults: number
  destination: string
  /** When Expedia Rapid VRBO is enabled later. */
  liveInventory: boolean
  message?: string
}

export async function fetchRentalSearch(tripId: string): Promise<RentalSearchResponse> {
  const res = await fetch(`/api/rentals/${tripId}/search`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load rental search')
  return data
}
