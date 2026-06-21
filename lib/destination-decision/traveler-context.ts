import { extractCountryFromDestinationName } from '../destination-country-rules'
import type { ParsedDestinationCard } from '../parse-destination-cards'

export type TravelerContext = {
  id: string
  user_id: string | null
  email: string
  name: string
  departure_city: string
  budget_ceiling: number | null
  step2: Record<string, unknown>
}

export function departureCityFromTraveler(t: {
  departure_city?: string | null
  step2?: Record<string, unknown> | null
}): string {
  const step2City = t.step2?.departureCity
  if (typeof step2City === 'string' && step2City.trim()) return step2City.trim()
  if (t.departure_city?.trim()) return t.departure_city.trim()
  return 'Unknown'
}

export function budgetFromTraveler(t: { step2?: Record<string, unknown> | null }): number | null {
  const budget = t.step2?.budget
  if (typeof budget !== 'string') return null
  const nums = budget.match(/\d+/g)
  if (!nums?.length) return null
  return Math.max(...nums.map(Number))
}

export function buildTravelerContexts(
  travelers: Array<{
    id: string
    email: string
    name?: string | null
    departure_city?: string | null
    step2?: Record<string, unknown> | null
  }>,
  profiles: Array<{ user_id: string; email: string }>
): TravelerContext[] {
  const emailToUser = new Map(profiles.map(p => [p.email.toLowerCase(), p.user_id]))
  return travelers.map(t => ({
    id: t.id,
    user_id: emailToUser.get(t.email.toLowerCase()) ?? null,
    email: t.email,
    name: t.name || t.email.split('@')[0],
    departure_city: departureCityFromTraveler(t),
    budget_ceiling: budgetFromTraveler(t),
    step2: (t.step2 as Record<string, unknown>) || {},
  }))
}

export function cardToOptionRows(
  card: ParsedDestinationCard,
  decisionId: string,
  tripId: string,
  sortBase: number,
  sourceTravelerId?: string | null
) {
  const country = extractCountryFromDestinationName(card.name)
  const tiers = ['budget', 'mid', 'luxury'] as const
  return tiers.map((tier, i) => ({
    decision_id: decisionId,
    trip_id: tripId,
    name: card.name,
    country,
    tier,
    source: 'ai_card' as const,
    source_traveler_id: sourceTravelerId ?? null,
    card_snapshot: card as unknown as Record<string, unknown>,
    group_summary: { tradeoff: card.tradeoff || card.highlight || '' },
    sort_order: sortBase + i,
  }))
}
