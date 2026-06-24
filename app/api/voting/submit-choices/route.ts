import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser, patchTravelerStep2 } from '@/lib/traveler-lookup'
import { computeGroupBudgetBounds } from '@/lib/group-budget'
import { allTravelersSubmittedChoices } from '@/lib/voting'
import { ensureVotingKickoff } from '@/lib/voting/kickoff'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { PLACEHOLDER_ROUND_ONE } from '@/components/voting/DestinationCard'
import { generateRoundOneContent } from '@/lib/voting/generate-content'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { assertPhaseEditable } from '@/lib/trip-phases/guards'
import { analyzeGroupDateOverlap, travelerProfilesFromRows } from '@/lib/group-date-overlap'

function parseCountry(name: string): string | null {
  const parts = name.split(',').map(s => s.trim())
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

async function ensureRoundOneContent(
  destinationName: string,
  country: string | null,
  existing: unknown
) {
  if (existing && typeof existing === 'object') return existing
  try {
    return await generateRoundOneContent({ destinationName, country })
  } catch {
    return PLACEHOLDER_ROUND_ONE
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)
    const traveler = await findTravelerForUser(supabase, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? supabase

    const phaseCheck = await assertPhaseEditable(db, tripId, traveler.id, user.id, 'brainstorm')
    if (!phaseCheck.ok) {
      return NextResponse.json({ error: phaseCheck.error }, { status: phaseCheck.status })
    }

    const step2 = (traveler.step2 || {}) as Record<string, unknown>
    const cardVotes = (step2.cardVotes || {}) as Record<string, boolean>
    const cards = (step2.cards || []) as ParsedDestinationCard[]
    const selectedNames = Object.entries(cardVotes).filter(([, v]) => v).map(([name]) => name)

    const { data: trip } = await supabase.from('trips').select('max_votes').eq('id', tripId).single()
    const required = trip?.max_votes ?? 2
    if (selectedNames.length !== required) {
      return NextResponse.json(
        { error: `Select exactly ${required} cards before submitting` },
        { status: 400 }
      )
    }

    const { data: travelers } = await supabase
      .from('travelers')
      .select('id, nickname, full_name, step2, fills_own_preferences')
      .eq('trip_id', tripId)

    const overlap = analyzeGroupDateOverlap(travelerProfilesFromRows(travelers || []))
    if (overlap.status === 'no_overlap' || overlap.status === 'too_short') {
      const who = overlap.fixes.map(f => f.displayName).join(', ')
      return NextResponse.json(
        {
          error: `${overlap.summary}${who ? ` Update dates: ${who}.` : ''}`,
          dateOverlap: overlap,
        },
        { status: 403 }
      )
    }

    const budgetBounds = computeGroupBudgetBounds(travelers || [])

    for (const name of selectedNames) {
      const card = cards.find(c => c.name === name)
      const country = parseCountry(name)

      const { data: existing } = await db
        .from('destination_analysis')
        .select('id, round_one_content')
        .eq('trip_id', tripId)
        .eq('destination_name', name)
        .maybeSingle()

      const roundOneContent = await ensureRoundOneContent(name, country, existing?.round_one_content)

      await db.from('destination_analysis').upsert(
        {
          id: existing?.id,
          trip_id: tripId,
          submitter_traveler_id: traveler.id,
          destination_name: name,
          country,
          card_snapshot: card || {},
          pushed_to_vote: true,
          round_one_content: roundOneContent,
          feasibility_floor: budgetBounds?.groupMinBudget ?? 900,
          highest_member_max: budgetBounds?.groupMaxBudget ?? 2100,
        },
        { onConflict: 'trip_id,destination_name' }
      )
    }

    await db.from('travelers').update({ choices_submitted: true }).eq('id', traveler.id)
    await patchTravelerStep2(supabase, traveler.id, {
      submittedCardPicks: selectedNames,
      cardsSubmittedAt: new Date().toISOString(),
    })

    let votingRound: number | null = null
    let totalCards = 0

    if (await allTravelersSubmittedChoices(db, tripId)) {
      const kickoff = await ensureVotingKickoff(db, tripId)
      if (kickoff) {
        votingRound = kickoff.votingRound
        totalCards = kickoff.totalCards
      }
    }

    return NextResponse.json({
      ok: true,
      votingRound,
      totalCards,
      allSubmitted: votingRound != null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
