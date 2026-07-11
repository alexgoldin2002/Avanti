import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createAdminClient } from '../supabase-admin'

export function supabaseFromRequest(request: NextRequest): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (token) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
  }
  return createClient(url, anonKey)
}

/**
 * Returns the service-role client ONLY for verified cron/system callers.
 * Every other caller (including anonymous ones) gets a request-scoped client
 * that carries the user's bearer token, so Supabase RLS is always enforced.
 *
 * Previously this fell back to the admin client whenever no Authorization
 * header was present, which let unauthenticated HTTP calls read trip/traveler
 * data straight past RLS. That fallback has been removed.
 */
export function adminOrAnon(request: NextRequest): SupabaseClient {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return createAdminClient()
  }
  return supabaseFromRequest(request)
}

export async function requireUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}

export async function requireOrganizer(supabase: SupabaseClient, tripId: string) {
  const user = await requireUser(supabase)
  const { data: trip } = await supabase.from('trips').select('organizer_id').eq('id', tripId).single()
  if (!trip || trip.organizer_id !== user.id) throw new Error('Organizer only')
  return user
}
