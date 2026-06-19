import { NextRequest, NextResponse } from 'next/server'
import { cardToOptionRows } from '@/lib/destination-decision/traveler-context'
import {
  DEFAULT_SUBMISSION_HOURS,
  DEFAULT_VOTING_HOURS,
} from '@/lib/destination-decision/types'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { notifyDecisionEventAsync } from '@/lib/destination-decision/notify-trip'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tripId, submissionHours = DEFAULT_SUBMISSION_HOURS } = body
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: existing } = await supabase
      .from('destination_decisions')
      .select('id, status')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (existing && existing.status !== 'draft' && existing.status !== 'cancelled') {
      return NextResponse.json({ decisionId: existing.id, status: existing.status, existing: true })
    }

    const { data: destRow } = await supabase
      .from('trip_destinations')
      .select('cards')
      .eq('trip_id', tripId)
      .single()

    const cards = (destRow?.cards || []) as ParsedDestinationCard[]
    if (cards.length < 4) {
      return NextResponse.json({ error: 'Complete Brainstorm first — need 4 destination cards.' }, { status: 400 })
    }

    const now = new Date()
    const submissionDeadline = new Date(now.getTime() + submissionHours * 60 * 60 * 1000)

    const { data: decision, error: decError } = await supabase
      .from('destination_decisions')
      .upsert({
        trip_id: tripId,
        status: 'suggestions_open',
        submission_deadline: submissionDeadline.toISOString(),
        budget_strictness: 'soft',
        settings: { submission_hours: submissionHours, voting_hours: DEFAULT_VOTING_HOURS },
        updated_at: now.toISOString(),
      }, { onConflict: 'trip_id' })
      .select()
      .single()

    if (decError || !decision) {
      return NextResponse.json({ error: decError?.message || 'Failed to create decision' }, { status: 500 })
    }

    await supabase.from('destination_options').delete().eq('decision_id', decision.id)

    const optionRows = cards.flatMap((card, i) =>
      cardToOptionRows(card, decision.id, tripId, i * 10)
    )

    const { data: inserted, error: optError } = await supabase
      .from('destination_options')
      .insert(optionRows)
      .select('id')

    if (optError) {
      return NextResponse.json({ error: optError.message }, { status: 500 })
    }

    await supabase
      .from('trips')
      .update({ destination_decision_id: decision.id })
      .eq('id', tripId)

    // Kick off background analysis (non-blocking)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    fetch(`${siteUrl}/api/destinations/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({ decisionId: decision.id, optionIds: (inserted || []).map(o => o.id) }),
    }).catch(() => {})

    const { data: tripRow } = await supabase.from('trips').select('name').eq('id', tripId).single()
    notifyDecisionEventAsync(supabase, {
      tripId,
      decisionId: decision.id,
      event: 'decision_started',
      tripName: tripRow?.name || 'Your trip',
    })

    return NextResponse.json({
      decisionId: decision.id,
      status: decision.status,
      submissionDeadline: decision.submission_deadline,
      optionCount: inserted?.length || 0,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
