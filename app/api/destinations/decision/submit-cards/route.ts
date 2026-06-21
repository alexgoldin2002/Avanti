import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { cardToOptionRows } from '@/lib/destination-decision/traveler-context'
import { requireUser, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { runDestinationAnalysis } from '@/lib/destination-decision/run-analysis'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { tripId, selectedCardNames } = await request.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const supabase = tryCreateAdminClient() ?? userClient

    const traveler = await findTravelerForUser(supabase, tripId, user.id)
    if (!traveler) {
      return NextResponse.json({ error: 'You are not on this trip.' }, { status: 403 })
    }

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!decision) {
      return NextResponse.json({ error: 'Start Step 2 from Invite first.' }, { status: 400 })
    }
    if (decision.status !== 'draft' && decision.status !== 'suggestions_open') {
      return NextResponse.json({ error: 'Cards already submitted.', status: decision.status }, { status: 400 })
    }

    if (decision.status === 'suggestions_open' && decision.submission_deadline) {
      if (new Date() >= new Date(decision.submission_deadline)) {
        return NextResponse.json({ error: 'Submission window has closed.' }, { status: 400 })
      }
    }

    const step2 = (traveler.step2 || {}) as Record<string, unknown>
    const allCards = (step2.cards || []) as ParsedDestinationCard[]
    if (allCards.length < 4) {
      return NextResponse.json({ error: 'Generate all 4 destination cards first.' }, { status: 400 })
    }

    const names = (selectedCardNames as string[] | undefined)?.filter(Boolean)
    const selected =
      names && names.length > 0
        ? allCards.filter(c => names.includes(c.name))
        : allCards

    if (selected.length === 0) {
      return NextResponse.json({ error: 'Select at least one card to submit.' }, { status: 400 })
    }

    const settings = (decision.settings as Record<string, unknown>) || {}
    const submissionsByTraveler =
      (settings.submissions_by_traveler as Record<string, { submitted_at: string; card_names: string[] }>) || {}
    const now = new Date().toISOString()

    await supabase
      .from('destination_options')
      .delete()
      .eq('decision_id', decision.id)
      .eq('source_traveler_id', traveler.id)

    const { data: maxSortRow } = await supabase
      .from('destination_options')
      .select('sort_order')
      .eq('decision_id', decision.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    let sortBase = (maxSortRow?.sort_order ?? -10) + 10

    const optionRows = selected.flatMap(card => {
      const rows = cardToOptionRows(card, decision.id, tripId, sortBase, traveler.id)
      sortBase += 10
      return rows
    })

    const { data: inserted, error: optError } = await supabase
      .from('destination_options')
      .insert(optionRows)
      .select('id')
    if (optError) {
      return NextResponse.json({ error: optError.message }, { status: 500 })
    }

    await supabase
      .from('destination_decisions')
      .update({
        status: 'suggestions_open',
        settings: {
          ...settings,
          brainstorm_submitted_at: now,
          submissions_by_traveler: {
            ...submissionsByTraveler,
            [traveler.id]: {
              submitted_at: now,
              card_names: selected.map(c => c.name),
            },
          },
        },
        updated_at: now,
      })
      .eq('id', decision.id)

    const newOptionIds = (inserted || []).map(o => o.id)
    after(async () => {
      try {
        await runDestinationAnalysis(supabase, decision.id, newOptionIds)
      } catch (err) {
        console.error('submit-cards analysis failed:', err)
      }
    })

    return NextResponse.json({
      ok: true,
      decisionId: decision.id,
      status: 'suggestions_open',
      cardCount: selected.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
