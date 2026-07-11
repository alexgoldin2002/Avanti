import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoordinationMode, DirectPreference, CostVsTime, MemberFlightPrefs } from './types'
import { perksForCards, statusPerks } from './card-perks'

// Shape of user_profiles.benefits_profile.profile_extras (written by /profile tabs).
type ProfileExtras = {
  travel?: {
    seat_preference?: string
    cabin_class?: string
    global_entry_number?: string
    redress_number?: string
    home_airport?: string
    backup_airports?: string[]
    departure_window?: string
    redeye_ok?: boolean
    nonstop_max_extra_usd?: number
    class_rule?: string
    avoid_airlines?: string[]
  }
  financial?: { preferred_currency?: string; primary_bank?: string }
  accessibility?: {
    mobility?: string[]
    sensory?: string[]
    assistance?: string[]
    allergies?: string[]
    dietary?: string[]
    notes?: string
  }
  airline_loyalty?: Array<{ airline: string; frequent_flyer_number: string; tier: string; credit_cards?: string[] }>
}

export type TravelerLoyalty = { airline: string; number: string | null; tier: string }

export type TravelerFlightRules = {
  departure_window: string | null
  redeye_ok: boolean | null
  nonstop_max_extra_usd: number | null
  class_rule: string | null
  avoid_airlines: string[]
}

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
  // Enriched from the traveler's own account profile (never another trip)
  seat_preference: string | null
  cabin_class: string | null
  loyalty: TravelerLoyalty[]
  known_traveler_number: string | null
  global_entry_number: string | null
  redress_number: string | null
  preferred_currency: string | null
  home_airport: string | null
  backup_airports: string[]
  flight_rules: TravelerFlightRules
  accessibility_notes: string[]
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
    group_overlap_start?: string | null
    group_overlap_end?: string | null
    group_overlap_nights?: number | null
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
      profile_extras?: ProfileExtras
    }
    const extras = benefits.profile_extras || {}
    const travel = extras.travel || {}
    const airlines = benefits.airlines || []

    // Merge airline status tiers (benefits page) with frequent-flyer numbers (profile extras).
    const loyaltyFromExtras = Array.isArray(extras.airline_loyalty) ? extras.airline_loyalty : []

    const baseCards = benefits.credit_cards?.length
      ? benefits.credit_cards
      : (t.credit_cards as string[] | undefined) || []
    const loyaltyCards = loyaltyFromExtras.flatMap(l => l.credit_cards || [])
    const cards = Array.from(new Set([...baseCards, ...loyaltyCards]))
    const loyaltyMap = new Map<string, TravelerLoyalty>()
    for (const a of airlines) loyaltyMap.set(a.airline, { airline: a.airline, number: null, tier: a.tier })
    for (const l of loyaltyFromExtras) {
      const existing = loyaltyMap.get(l.airline)
      loyaltyMap.set(l.airline, {
        airline: l.airline,
        number: l.frequent_flyer_number || existing?.number || null,
        tier: l.tier || existing?.tier || 'Member',
      })
    }

    const accessibility = extras.accessibility || {}
    const accessibilityNotes = [
      ...(accessibility.mobility || []),
      ...(accessibility.sensory || []),
      ...(accessibility.assistance || []),
    ]

    return {
      id: t.id,
      name: t.name || t.full_name || t.email?.split('@')[0] || 'Traveler',
      email: t.email,
      departure_city:
        t.departure_city ||
        (t.step2 as { departureCity?: string })?.departureCity ||
        travel.home_airport ||
        'Unknown',
      user_id: t.user_id || profile?.user_id || null,
      credit_cards: cards,
      airlines,
      card_perks_summary: perksForCards(cards),
      status_perks_summary: airlines.flatMap(a => statusPerks(a.airline, a.tier)),
      passport_on_file: !!t.passport_number,
      tsa_on_file: !!t.tsa_known_traveler || !!travel.global_entry_number,
      seat_preference: travel.seat_preference || null,
      cabin_class: travel.cabin_class || null,
      loyalty: Array.from(loyaltyMap.values()),
      known_traveler_number: (t.tsa_known_traveler as string | null) || null,
      global_entry_number: travel.global_entry_number || null,
      redress_number: travel.redress_number || null,
      preferred_currency: extras.financial?.preferred_currency || null,
      home_airport: travel.home_airport || null,
      backup_airports: Array.isArray(travel.backup_airports) ? travel.backup_airports : [],
      flight_rules: {
        departure_window: travel.departure_window || null,
        redeye_ok: typeof travel.redeye_ok === 'boolean' ? travel.redeye_ok : null,
        nonstop_max_extra_usd:
          typeof travel.nonstop_max_extra_usd === 'number' ? travel.nonstop_max_extra_usd : null,
        class_rule: travel.class_rule || null,
        avoid_airlines: Array.isArray(travel.avoid_airlines) ? travel.avoid_airlines : [],
      },
      accessibility_notes: accessibilityNotes,
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
