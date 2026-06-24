import type { SupabaseClient } from '@supabase/supabase-js'
import { computeGroupBudgetBounds } from '@/lib/group-budget'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { PLACEHOLDER_ROUND_ONE } from '@/components/voting/DestinationCard'
import { stampVotingOpened } from '@/lib/trip-phases/stamp'

export type TravelerChoiceRow = {
  id: string
  choices_submitted?: boolean | null
  round_one_submitted?: boolean | null
  round_two_submitted?: boolean | null
  fills_own_preferences?: boolean | null
  can_vote?: boolean | null
  step2?: Record<string, unknown> | null
}

function parseCountry(name: string): string | null {
  const parts = name.split(',').map(s => s.trim())
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

export function getSelectedCardNames(
  step2: Record<string, unknown> | null | undefined,
  maxVotes: number
): string[] {
  const s2 = step2 || {}
  const picks = s2.submittedCardPicks
  if (Array.isArray(picks) && picks.length > 0) {
    return picks.map(String).slice(0, maxVotes)
  }
  const cardVotes = s2.cardVotes as Record<string, boolean> | undefined
  if (cardVotes) {
    const selected = Object.entries(cardVotes)
      .filter(([, v]) => v)
      .map(([name]) => name)
    if (selected.length > 0) return selected.slice(0, maxVotes)
  }
  return []
}

export function travelerNeedsOwnChoices(traveler: TravelerChoiceRow): boolean {
  return traveler.fills_own_preferences !== false
}

export function travelerCanVoteInRound(traveler: TravelerChoiceRow): boolean {
  return travelerNeedsOwnChoices(traveler) && traveler.can_vote !== false
}

export function travelerHasSubmittedChoices(
  traveler: TravelerChoiceRow,
  maxVotes: number
): boolean {
  if (!travelerNeedsOwnChoices(traveler)) return true
  if (traveler.choices_submitted) return true
  const picks = getSelectedCardNames(traveler.step2, maxVotes)
  if (Array.isArray((traveler.step2 || {}).submittedCardPicks) &&
      ((traveler.step2 || {}).submittedCardPicks as unknown[]).length > 0) {
    return true
  }
  return picks.length >= maxVotes
}

export async function getVotingEligibleTravelers(
  supabase: SupabaseClient,
  tripId: string
): Promise<TravelerChoiceRow[]> {
  const { data } = await supabase
    .from('travelers')
    .select('id, choices_submitted, fills_own_preferences, step2')
    .eq('trip_id', tripId)
  return (data || []).filter(travelerNeedsOwnChoices)
}

export async function getChoicesSubmissionStatus(
  supabase: SupabaseClient,
  tripId: string,
  maxVotes: number
): Promise<{ eligible: number; submitted: number; pendingNicknames: string[] }> {
  const { data: rows } = await supabase
    .from('travelers')
    .select('id, nickname, full_name, choices_submitted, fills_own_preferences, step2')
    .eq('trip_id', tripId)

  const eligible = (rows || []).filter(travelerNeedsOwnChoices)
  const pending = eligible.filter(t => !travelerHasSubmittedChoices(t, maxVotes))
  return {
    eligible: eligible.length,
    submitted: eligible.length - pending.length,
    pendingNicknames: pending.map(t => {
      const row = t as { nickname?: string; full_name?: string }
      return row.nickname || row.full_name || 'A traveler'
    }),
  }
}

async function upsertTravelerDestinations(
  supabase: SupabaseClient,
  tripId: string,
  traveler: TravelerChoiceRow,
  selectedNames: string[],
  budgetBounds: ReturnType<typeof computeGroupBudgetBounds>
): Promise<void> {
  const cards = ((traveler.step2 || {}).cards || []) as ParsedDestinationCard[]

  for (const name of selectedNames) {
    if (!name) continue
    const card = cards.find(c => c.name === name || c.destination === name)
    const country = parseCountry(name)

    const { data: existing, error: readErr } = await supabase
      .from('destination_analysis')
      .select('id, round_one_content')
      .eq('trip_id', tripId)
      .eq('destination_name', name)
      .maybeSingle()

    if (readErr) throw new Error(readErr.message)

    const { error: upsertErr } = await supabase.from('destination_analysis').upsert(
      {
        id: existing?.id,
        trip_id: tripId,
        submitter_traveler_id: traveler.id,
        destination_name: name,
        country,
        card_snapshot: card || {},
        pushed_to_vote: true,
        round_one_content: existing?.round_one_content || PLACEHOLDER_ROUND_ONE,
        feasibility_floor: budgetBounds?.groupMinBudget ?? 900,
        highest_member_max: budgetBounds?.groupMaxBudget ?? 2100,
      },
      { onConflict: 'trip_id,destination_name' }
    )

    if (upsertErr) throw new Error(upsertErr.message)
  }
}

async function countVoteCards(supabase: SupabaseClient, tripId: string): Promise<number> {
  const { count, error } = await supabase
    .from('destination_analysis')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('pushed_to_vote', true)
  if (error) throw new Error(error.message)
  return count || 0
}

/** Backfill destination rows and start voting when every eligible traveler is ready. */
export async function ensureVotingKickoff(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ votingRound: number; totalCards: number } | null> {
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('voting_round, max_votes, total_cards')
    .eq('id', tripId)
    .single()

  if (tripErr) throw new Error(tripErr.message)

  if (trip?.voting_round != null) {
    return { votingRound: trip.voting_round, totalCards: trip.total_cards ?? 0 }
  }

  const maxVotes = trip?.max_votes ?? 2
  const eligible = await getVotingEligibleTravelers(supabase, tripId)
  if (!eligible.length) return null
  if (!eligible.every(t => travelerHasSubmittedChoices(t, maxVotes))) return null

  const { data: allTravelers } = await supabase
    .from('travelers')
    .select('id, step2')
    .eq('trip_id', tripId)
  const budgetBounds = computeGroupBudgetBounds(allTravelers || [])

  for (const traveler of eligible) {
    const selectedNames = getSelectedCardNames(traveler.step2, maxVotes)
    if (selectedNames.length === 0) continue

    await upsertTravelerDestinations(supabase, tripId, traveler, selectedNames, budgetBounds)

    if (!traveler.choices_submitted) {
      const { error } = await supabase
        .from('travelers')
        .update({ choices_submitted: true })
        .eq('id', traveler.id)
      if (error) throw new Error(error.message)
    }
  }

  let totalCards = await countVoteCards(supabase, tripId)
  if (totalCards === 0) return null

  const votingRound = totalCards >= 6 ? 1 : 2

  const { error: updateTripErr } = await supabase
    .from('trips')
    .update({ total_cards: totalCards, voting_round: votingRound })
    .eq('id', tripId)

  if (updateTripErr) throw new Error(updateTripErr.message)

  if (votingRound === 2) {
    const { error } = await supabase
      .from('destination_analysis')
      .update({ advanced_to_round_two: true })
      .eq('trip_id', tripId)
      .eq('pushed_to_vote', true)
    if (error) throw new Error(error.message)
  }

  await stampVotingOpened(supabase, tripId, votingRound)

  return { votingRound, totalCards }
}
