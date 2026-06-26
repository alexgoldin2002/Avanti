import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser, patchTravelerStep2 } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { PLACEHOLDER_ROUND_ONE } from '@/lib/voting/constants'
import {
  buildRoundOneContentFromSnapshot,
  isStaleRoundOneContent,
} from '@/lib/voting/round-one-content'
import { generateRoundOneContent } from '@/lib/voting/generate-content'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { resolveStep2SubmitCards } from '@/lib/parse-destination-matrix'
import { assertPhaseEditable } from '@/lib/trip-phases/guards'
import { analyzeGroupDateOverlap, travelerProfilesFromRows } from '@/lib/group-date-overlap'
import type { RoundOneContent } from '@/lib/voting/types'
import { resolveTripTravelWindow, getTypicalWeatherLine } from '@/lib/weather/climate-summary'
import { syncTripGroupOverlap } from '@/lib/group-date-overlap/sync-trip-overlap'
import { resolveRoundOneWeather } from '@/lib/weather/round-one-weather'

function parseCountry(name: string): string | null {
  const parts = name.split(',').map(s => s.trim())
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

async function ensureRoundOneContent(
  destinationName: string,
  country: string | null,
  existing: unknown,
  cardSnapshot: Record<string, unknown>
) {
  if (existing && !isStaleRoundOneContent(existing, destinationName)) {
    return existing
  }

  const fromSnapshot = buildRoundOneContentFromSnapshot(cardSnapshot)
  if (fromSnapshot && !isStaleRoundOneContent(fromSnapshot, destinationName)) {
    return fromSnapshot
  }

  try {
    return await generateRoundOneContent({ destinationName, country })
  } catch {
    return fromSnapshot ?? PLACEHOLDER_ROUND_ONE
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
    const cards = resolveStep2SubmitCards(step2)
    const selectedNames = Object.entries(cardVotes).filter(([, v]) => v).map(([name]) => name)

    const { data: trip } = await supabase
      .from('trips')
      .select(
        'max_votes, group_overlap_start, group_overlap_end, group_overlap_nights, group_overlap_status, group_overlap_computed_at'
      )
      .eq('id', tripId)
      .single()
    const required = trip?.max_votes ?? 2
    if (selectedNames.length !== required) {
      return NextResponse.json(
        { error: `Select exactly ${required} cards before submitting` },
        { status: 400 }
      )
    }

    const cardNames = new Set(cards.map(c => c.name))
    const invalid = selectedNames.filter(name => !cardNames.has(name))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'Some selected cards are no longer available — refresh and pick again.' },
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

    await syncTripGroupOverlap(db, tripId)
    const { data: tripOverlap } = await db
      .from('trips')
      .select(
        'group_overlap_start, group_overlap_end, group_overlap_nights, group_overlap_status, group_overlap_computed_at'
      )
      .eq('id', tripId)
      .single()
    const travelWindow = resolveTripTravelWindow({ trip: tripOverlap ?? trip })

    for (const name of selectedNames) {
      const card = cards.find(c => c.name === name)
      const country = parseCountry(name)

      const { data: existing } = await db
        .from('destination_analysis')
        .select('id, round_one_content')
        .eq('trip_id', tripId)
        .eq('destination_name', name)
        .maybeSingle()

      let roundOneContent = (await ensureRoundOneContent(
        name,
        country,
        existing?.round_one_content,
        (card || {}) as Record<string, unknown>
      )) as RoundOneContent

      const climateLine = travelWindow
        ? await getTypicalWeatherLine(name, travelWindow, country)
        : null
      roundOneContent = {
        ...roundOneContent,
        weather: resolveRoundOneWeather({
          climateLine,
          hasTravelWindow: travelWindow != null,
        }),
      }

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
        },
        { onConflict: 'trip_id,destination_name' }
      )
    }

    await db.from('travelers').update({ choices_submitted: true }).eq('id', traveler.id)
    await patchTravelerStep2(supabase, traveler.id, {
      submittedCardPicks: selectedNames,
      cardsSubmittedAt: new Date().toISOString(),
      cards,
    })

    return NextResponse.json({
      ok: true,
      submitted: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
