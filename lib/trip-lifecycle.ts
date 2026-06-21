import { supabase } from '@/lib/supabase'
import { deleteTripData, detachTravelerExpenses } from '@/lib/trip-delete-core'

/** Permanently erase a trip and all related data. Host-only — verify before calling. */
export async function deleteTripPermanently(tripId: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not signed in' }

  const res = await fetch(`/api/trips/${tripId}/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body.error || 'Failed to delete trip' }
  return {}
}

/** Remove the current user from a trip. Non-host only — verify before calling. */
export async function leaveTripAsMember(tripId: string, userId: string): Promise<{ error?: string }> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: traveler, error: travelerFetchError } = await supabase
    .from('travelers')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()

  if (travelerFetchError) return { error: travelerFetchError.message }

  const travelerId = traveler?.id
  if (travelerId) {
    const expenseResult = await detachTravelerExpenses(supabase, travelerId, tripId)
    if (expenseResult.error) return expenseResult
  }

  let deleteQuery = supabase.from('travelers').delete().eq('trip_id', tripId)
  if (travelerId) {
    deleteQuery = deleteQuery.eq('user_id', userId)
  } else if (profile?.email) {
    deleteQuery = deleteQuery.eq('email', profile.email)
  } else {
    return { error: 'Traveler not found on this trip.' }
  }

  const { error } = await deleteQuery
  if (error) return { error: error.message }
  return {}
}
