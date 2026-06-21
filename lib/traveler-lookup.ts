import type { SupabaseClient } from '@supabase/supabase-js'

export type TravelerRow = {
  id: string
  user_id?: string | null
  email?: string | null
  step2?: Record<string, unknown> | null
}

export async function findTravelerForUser(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<TravelerRow | null> {
  const { data: byUser } = await supabase
    .from('travelers')
    .select('id, user_id, email, step2')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()
  if (byUser) return byUser

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile?.email) return null

  const { data: byEmail } = await supabase
    .from('travelers')
    .select('id, user_id, email, step2')
    .eq('trip_id', tripId)
    .ilike('email', profile.email)
    .maybeSingle()
  return byEmail
}

export async function patchTravelerStep2(
  supabase: SupabaseClient,
  travelerId: string,
  patch: Record<string, unknown>
) {
  const { data: traveler } = await supabase
    .from('travelers')
    .select('step2')
    .eq('id', travelerId)
    .single()
  const existing = (traveler?.step2 as Record<string, unknown>) || {}
  return supabase
    .from('travelers')
    .update({ step2: { ...existing, ...patch } })
    .eq('id', travelerId)
}
