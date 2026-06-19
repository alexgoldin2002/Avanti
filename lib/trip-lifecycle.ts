import { supabase } from '@/lib/supabase'

/** Remove all expenses for a trip. */
async function deleteTripExpenses(tripId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('expenses').delete().eq('trip_id', tripId)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return {}
    return { error: error.message }
  }

  return {}
}

/** Detach a traveler from expense records when they leave a trip. */
async function deleteTravelerExpenses(travelerId: string, tripId: string): Promise<{ error?: string }> {
  const { error: payerError } = await supabase
    .from('expenses')
    .update({ paid_by_traveler_id: null })
    .eq('trip_id', tripId)
    .eq('paid_by_traveler_id', travelerId)

  if (payerError) {
    if (payerError.code === '42P01' || payerError.code === 'PGRST205') return {}
    return { error: payerError.message }
  }

  const { data: allExpenses, error: fetchError } = await supabase
    .from('expenses')
    .select('id, participant_traveler_ids')
    .eq('trip_id', tripId)

  if (fetchError) {
    if (fetchError.code === '42P01' || fetchError.code === 'PGRST205') return {}
    return { error: fetchError.message }
  }

  for (const exp of allExpenses || []) {
    const ids = exp.participant_traveler_ids || []
    if (!ids.includes(travelerId)) continue
    const { error } = await supabase
      .from('expenses')
      .update({ participant_traveler_ids: ids.filter((id: string) => id !== travelerId) })
      .eq('id', exp.id)
    if (error) return { error: error.message }
  }

  return {}
}

/** Permanently erase a trip and all related data. Host-only — verify before calling. */
export async function deleteTripPermanently(tripId: string): Promise<{ error?: string }> {
  const { data: votes } = await supabase.from('group_votes').select('id').eq('trip_id', tripId)
  const voteIds = (votes || []).map(v => v.id)

  if (voteIds.length > 0) {
    await supabase.from('group_vote_responses').delete().in('vote_id', voteIds)
  }

  const expenseResult = await deleteTripExpenses(tripId)
  if (expenseResult.error) return expenseResult

  await supabase.from('destination_decisions').delete().eq('trip_id', tripId)
  await supabase.from('trip_booking_inbox').delete().eq('trip_id', tripId)
  await supabase.from('trip_inspirations').delete().eq('trip_id', tripId)

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
    const expenseResult = await deleteTravelerExpenses(travelerId, tripId)
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
