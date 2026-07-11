import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeStep2ForPrompt } from '@/lib/voting/step2-preferences'
import type { MemberStayPrefs, StayCoordinationMode, StayType } from './types'

export type TravelerStayContext = {
  id: string
  name: string
  email: string
  user_id: string | null
  step2_summary: string
  step2_accommodation: string | null
  step2_budget: string | null
}

export type StayAnalysisInput = {
  trip: {
    name: string
    destination: string
    locked_tier: string | null
    locked_date_start: string | null
    locked_date_end: string | null
    start_date: string | null
    end_date: string | null
  }
  trip_id: string
  coordination_mode: StayCoordinationMode
  mix_notes: string | null
  vote_estimate_per_night: number | null
  guest_count: number
  travelers: TravelerStayContext[]
  member_prefs: Array<MemberStayPrefs & { traveler_id: string; traveler_name: string }>
}

export function defaultMemberStayPrefs(ctx: TravelerStayContext): MemberStayPrefs {
  const acc = (ctx.step2_accommodation || '').toLowerCase()
  let stay_type: StayType = 'any'
  if (acc.includes('resort')) stay_type = 'resort'
  else if (acc.includes('airbnb') || acc.includes('villa') || acc.includes('rental')) stay_type = 'rental'
  else if (acc.includes('boutique') || acc.includes('guesthouse')) stay_type = 'boutique'
  else if (acc.includes('hotel')) stay_type = 'hotel'

  return {
    stay_type,
    private_room: true,
    shared_space_ok: true,
    max_budget_per_night: null,
    neighborhood_notes: null,
    amenities: [],
    notes: null,
  }
}

export async function buildStayTravelerContexts(
  supabase: SupabaseClient,
  tripId: string
): Promise<TravelerStayContext[]> {
  const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)

  return (travelers || []).map(t => {
    const step2 = (t.step2 || {}) as Record<string, unknown>
    return {
      id: t.id,
      name: t.name || t.email || 'Traveler',
      email: t.email || '',
      user_id: t.user_id,
      step2_summary: summarizeStep2ForPrompt(step2),
      step2_accommodation: typeof step2.accommodation === 'string' ? step2.accommodation : null,
      step2_budget: typeof step2.budget === 'string' ? step2.budget : null,
    }
  })
}
