import type { SupabaseClient } from '@supabase/supabase-js'

export type UserTrip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  locked_date_start?: string | null
  locked_date_end?: string | null
  organizer_id: string
  created_at: string
  /** True when the current user hosts this trip */
  isOrganizer: boolean
}

/**
 * Trips the user actively belongs to: hosts (organizer_id) or members (travelers.user_id).
 * Does not use email-only traveler rows — those can outlive leave/delete and cause ghost trips.
 */
export async function fetchUserTrips(
  supabase: SupabaseClient,
  userId: string
): Promise<UserTrip[]> {
  const [{ data: hosted }, { data: memberRows }] = await Promise.all([
    supabase.from('trips').select('*').eq('organizer_id', userId),
    supabase.from('travelers').select('trip_id').eq('user_id', userId),
  ])

  const memberIds = [...new Set((memberRows || []).map(r => r.trip_id).filter(Boolean))]
  let memberTrips: typeof hosted = []
  if (memberIds.length > 0) {
    const { data } = await supabase.from('trips').select('*').in('id', memberIds)
    memberTrips = data || []
  }

  const byId = new Map<string, UserTrip>()
  for (const t of hosted || []) {
    byId.set(t.id, { ...t, isOrganizer: true })
  }
  for (const t of memberTrips || []) {
    if (!byId.has(t.id)) {
      byId.set(t.id, { ...t, isOrganizer: t.organizer_id === userId })
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function filterTripsWithDestination(trips: UserTrip[]): UserTrip[] {
  return trips.filter(t => t.destination && t.destination !== 'TBD')
}
