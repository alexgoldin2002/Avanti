import { supabase } from '@/lib/supabase'

/** Remove expense-splitting rows for a trip (child tables first). */
async function deleteTripExpenses(tripId: string): Promise<{ error?: string }> {
  const { data: expenses, error: fetchError } = await supabase
    .from('expenses')
    .select('id')
    .eq('trip_id', tripId)

  if (fetchError) {
    // Expense tables may not exist on older databases — skip cleanup in that case.
    if (fetchError.code === '42P01' || fetchError.code === 'PGRST205') return {}
    return { error: fetchError.message }
  }

  const expenseIds = (expenses || []).map(e => e.id)
  if (expenseIds.length === 0) return {}

  const { data: lineItems, error: lineItemsFetchError } = await supabase
    .from('expense_line_items')
    .select('id')
    .in('expense_id', expenseIds)

  if (lineItemsFetchError) return { error: lineItemsFetchError.message }

  const lineItemIds = (lineItems || []).map(li => li.id)

  if (lineItemIds.length > 0) {
    const { error } = await supabase
      .from('expense_item_participants')
      .delete()
      .in('line_item_id', lineItemIds)
    if (error) return { error: error.message }
  }

  const { error: totalsError } = await supabase
    .from('expense_person_totals')
    .delete()
    .in('expense_id', expenseIds)
  if (totalsError) return { error: totalsError.message }

  const { error: lineItemsError } = await supabase
    .from('expense_line_items')
    .delete()
    .in('expense_id', expenseIds)
  if (lineItemsError) return { error: lineItemsError.message }

  const { error: expensesError } = await supabase.from('expenses').delete().eq('trip_id', tripId)
  if (expensesError) return { error: expensesError.message }

  return {}
}

/** Remove expense-splitting rows that reference a traveler. */
async function deleteTravelerExpenses(travelerId: string): Promise<{ error?: string }> {
  const { error: participantsError } = await supabase
    .from('expense_item_participants')
    .delete()
    .eq('traveler_id', travelerId)

  if (participantsError) {
    if (participantsError.code === '42P01' || participantsError.code === 'PGRST205') return {}
    return { error: participantsError.message }
  }

  const { error: totalsError } = await supabase
    .from('expense_person_totals')
    .delete()
    .eq('traveler_id', travelerId)
  if (totalsError) return { error: totalsError.message }

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
  const { data: traveler, error: travelerFetchError } = await supabase
    .from('travelers')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()

  if (travelerFetchError) return { error: travelerFetchError.message }
  if (!traveler) return { error: 'Traveler not found on this trip.' }

  const expenseResult = await deleteTravelerExpenses(traveler.id)
  if (expenseResult.error) return expenseResult

  const { error } = await supabase
    .from('travelers')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  return {}
}
