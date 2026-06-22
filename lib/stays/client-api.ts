import { supabase } from '@/lib/supabase'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

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

export type LiveStaysResponse = {
  configured: boolean
  offers: LiveStayOffer[]
  error?: string
  searchLinks?: {
    google: string
    booking: string
    expedia: string
    vrbo: string
  }
  checkIn?: string
  checkOut?: string
  adults?: number
}

export async function fetchLiveStays(tripId: string): Promise<LiveStaysResponse> {
  const res = await fetch(`/api/stays/${tripId}/search`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to search stays')
  return data
}
