import { supabase } from '@/lib/supabase'

/** Permanently erase a trip and all related data. Host-only — verify before calling. */
export async function deleteTripPermanently(tripId: string): Promise<{ error?: string }> {
  const { data: votes } = await supabase.from('group_votes').select('id').eq('trip_id', tripId)
  const voteIds = (votes || []).map(v => v.id)

  if (voteIds.length > 0) {
    await supabase.from('group_vote_responses').delete().in('vote_id', voteIds)
  }

  await Promise.all([
    supabase.from('group_votes').delete().eq('trip_id', tripId),
    supabase.from('trip_votes').delete().eq('trip_id', tripId),
    supabase.from('trip_preferences').delete().eq('trip_id', tripId),
    supabase.from('trip_conversations').delete().eq('trip_id', tripId),
    supabase.from('trip_settings').delete().eq('trip_id', tripId),
    supabase.from('nudges').delete().eq('trip_id', tripId),
    supabase.from('travelers').delete().eq('trip_id', tripId),
    supabase.from('itineraries').delete().eq('trip_id', tripId),
    supabase.from('trip_destinations').delete().eq('trip_id', tripId),
  ])

  const { error } = await supabase.from('trips').delete().eq('id', tripId)
  if (error) return { error: error.message }
  return {}
}

/** Remove the current user from a trip. Non-host only — verify before calling. */
export async function leaveTripAsMember(tripId: string, userId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('travelers')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  return {}
}
