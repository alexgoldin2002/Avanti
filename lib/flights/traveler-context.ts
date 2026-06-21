import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoordinationMode, DirectPreference, CostVsTime, MemberFlightPrefs } from './types'
import { perksForCards, statusPerks } from './card-perks'

export type TravelerFlightContext = {
  id: string
  name: string
  email: string
  departure_city: string
  user_id: string | null
  credit_cards: string[]
  airlines: Array<{ airline: string; tier: string }>
  card_perks_summary: string[]
  status_perks_summary: string[]
  passport_on_file: boolean
  tsa_on_file: boolean
}

export type FlightAnalysisInput = {
  trip: {
    name: string
    destination: string
    locked_tier: string | null
    date_range_start: string | null
    date_range_end: string | null
    start_date: string | null
    end_date: string | null
    locked_date_start: string | null
    locked_date_end: string | null
  }
  coordination_mode: CoordinationMode
  mix_notes: string | null
  vote_estimate_per_person: number | null
  travelers: TravelerFlightContext[]
  member_prefs: Array<MemberFlightPrefs & { traveler_id: string; traveler_name: string }>
}

export async function buildFlightTravelerContexts(
  supabase: SupabaseClient,
  tripId: string
): Promise<TravelerFlightContext[]> {
  const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const { data: profiles } = await supabase.from('user_profiles').select('user_id, email, benefits_profile')

  return (travelers || []).map(t => {
    const profile = profiles?.find(
      p => p.user_id === t.user_id || p.email?.toLowerCase() === t.email?.toLowerCase()
    )
    const benefits = (profile?.benefits_profile || {}) as {
      credit_cards?: string[]
      airlines?: Array<{ airline: string; tier: string }>
    }
    const cards = benefits.credit_cards?.length
      ? benefits.credit_cards
      : (t.credit_cards as string[] | undefined) || []
    const airlines = benefits.airlines || []

    return {
      id: t.id,
      name: t.name || t.full_name || t.email?.split('@')[0] || 'Traveler',
      email: t.email,
      departure_city: t.departure_city || (t.step2 as { departureCity?: string })?.departureCity || 'Unknown',
      user_id: t.user_id || profile?.user_id || null,
      credit_cards: cards,
      airlines,
      card_perks_summary: perksForCards(cards),
      status_perks_summary: airlines.flatMap(a => statusPerks(a.airline, a.tier)),
      passport_on_file: !!t.passport_number,
      tsa_on_file: !!t.tsa_known_traveler,
    }
  })
}

export function defaultMemberPrefs(ctx: TravelerFlightContext): MemberFlightPrefs {
  return {
    direct_preference: 'one_stop_ok' as DirectPreference,
    preferred_airlines: ctx.airlines.map(a => a.airline),
    avoid_airlines: [],
    cost_vs_time: 'balance' as CostVsTime,
    wants_group_routing: null,
    notes: null,
  }
}
