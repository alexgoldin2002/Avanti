import { supabase } from '@/lib/supabase'
import type { ParsedBooking } from './types'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export async function fetchTripBookings(tripId: string) {
  const res = await fetch(`/api/bookings/${tripId}`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load bookings')
  return data as { inboxAddress: string; bookings: Array<Record<string, unknown>> }
}

export async function parseBookingFile(tripId: string, fileBase64: string, fileName: string, mimeType: string) {
  const res = await fetch('/api/bookings/parse', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, fileBase64, fileName, mimeType }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to parse')
  return data as { parsed: ParsedBooking; source: string }
}

export async function saveBooking(
  tripId: string,
  parsed: ParsedBooking,
  source: string,
  fileBase64?: string,
  fileName?: string,
  mimeType?: string
) {
  const res = await fetch(`/api/bookings/${tripId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, parsed, source, fileBase64, fileName, mimeType }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save')
  return data
}

export const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  tour: 'Tour',
  flight: 'Flight',
  activity: 'Activity',
  transport: 'Transport',
  other: 'Other',
}
