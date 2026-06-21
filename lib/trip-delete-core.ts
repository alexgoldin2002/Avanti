import type { SupabaseClient } from '@supabase/supabase-js'

/** Shared delete steps — pass admin client from API for host deletes. */
export async function deleteTripData(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ error?: string }> {
  const { data: votes } = await supabase.from('group_votes').select('id').eq('trip_id', tripId)
  const voteIds = (votes || []).map(v => v.id)

  if (voteIds.length > 0) {
    await supabase.from('group_vote_responses').delete().in('vote_id', voteIds)
  }

  const { error: expenseError } = await supabase.from('expenses').delete().eq('trip_id', tripId)
  if (expenseError && expenseError.code !== '42P01' && expenseError.code !== 'PGRST205') {
    return { error: expenseError.message }
  }

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

/** Detach a traveler from expense records when they leave a trip. */
export async function detachTravelerExpenses(
  supabase: SupabaseClient,
  travelerId: string,
  tripId: string
): Promise<{ error?: string }> {
  const { error: payerError } = await supabase
    .from('expenses')
    .update({ paid_by_traveler_id: null })
    .eq('trip_id', tripId)
    .eq('paid_by_traveler_id', travelerId)

  if (payerError && payerError.code !== '42P01' && payerError.code !== 'PGRST205') {
    return { error: payerError.message }
  }

  const { data: allExpenses, error: fetchError } = await supabase
    .from('expenses')
    .select('id, participant_traveler_ids')
    .eq('trip_id', tripId)

  if (fetchError && fetchError.code !== '42P01' && fetchError.code !== 'PGRST205') {
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
