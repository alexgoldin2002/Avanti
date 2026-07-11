import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountCompanion = {
  id: string
  owner_user_id: string
  linked_user_id: string | null
  full_name: string
  nickname: string | null
  relationship: string | null
  date_of_birth: string | null
  passport_number: string | null
  passport_expiry: string | null
  tsa_known_traveler: string | null
  departure_city: string | null
  dietary_restrictions: string | null
  notes: string | null
}

export type CompanionInput = {
  full_name: string
  nickname?: string
  relationship?: string
  passport_number?: string
  tsa_known_traveler?: string
  date_of_birth?: string
  linked_user_id?: string | null
}

export async function listAccountCompanions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('account_companions')
    .select('*')
    .eq('owner_user_id', userId)
    .order('full_name')
  if (error) throw error
  return (data || []) as AccountCompanion[]
}

export async function upsertAccountCompanion(
  supabase: SupabaseClient,
  userId: string,
  input: CompanionInput & { id?: string }
) {
  const row = {
    owner_user_id: userId,
    full_name: input.full_name.trim(),
    nickname: input.nickname?.trim() || null,
    relationship: input.relationship?.trim() || null,
    passport_number: input.passport_number?.trim() || null,
    tsa_known_traveler: input.tsa_known_traveler?.trim() || null,
    date_of_birth: input.date_of_birth || null,
    linked_user_id: input.linked_user_id ?? null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('account_companions')
      .update(row)
      .eq('id', input.id)
      .eq('owner_user_id', userId)
      .select()
      .single()
    if (error) throw error
    return data as AccountCompanion
  }

  const { data, error } = await supabase.from('account_companions').insert(row).select().single()
  if (error) throw error
  return data as AccountCompanion
}

export async function deleteAccountCompanion(
  supabase: SupabaseClient,
  userId: string,
  companionId: string
) {
  const { error } = await supabase
    .from('account_companions')
    .delete()
    .eq('id', companionId)
    .eq('owner_user_id', userId)
  if (error) throw error
}

export async function createManagedTripTraveler(
  supabase: SupabaseClient,
  input: {
    tripId: string
    managerUserId: string
    companion: AccountCompanion
    managerProfile?: { email?: string; full_name?: string }
  }
) {
  const { data, error } = await supabase
    .from('travelers')
    .insert({
      trip_id: input.tripId,
      full_name: input.companion.full_name,
      nickname: input.companion.nickname || input.companion.full_name.split(' ')[0],
      email: '',
      role: 'dependent',
      profile_complete: !!(input.companion.passport_number),
      status: 'approved',
      user_id: input.companion.linked_user_id || null,
      managed_by_user_id: input.managerUserId,
      account_companion_id: input.companion.id,
      can_vote: false,
      fills_own_preferences: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Manager votes on behalf of linked dependents; delegated members cannot vote. */
export function travelerCanVote(traveler: { can_vote?: boolean | null }) {
  return traveler.can_vote !== false
}

export async function getMyTripTraveler(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
) {
  const { data } = await supabase
    .from('travelers')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export function canManageTraveler(
  traveler: { managed_by_user_id?: string | null; user_id?: string | null },
  userId: string
) {
  return traveler.managed_by_user_id === userId || traveler.user_id === userId
}
