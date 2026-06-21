import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 300

import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { analyzeFlightScenarios } from '@/lib/flights/analyze-core'
import {
  buildFlightTravelerContexts,
  defaultMemberPrefs,
} from '@/lib/flights/traveler-context'
import type { CoordinationMode, MemberFlightPrefs } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip?.destination || trip.destination === 'TBD') {
      return NextResponse.json({ error: 'Lock destination first' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!session?.coordination_mode) {
      return NextResponse.json({ error: 'Set coordination mode first' }, { status: 400 })
    }

    await supabase
      .from('trip_flight_sessions')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', session.id)

    const { data: prefsRows } = await supabase
      .from('trip_flight_member_prefs')
      .select('*')
      .eq('session_id', session.id)

    const contexts = await buildFlightTravelerContexts(supabase, tripId)
    const member_prefs = contexts.map(ctx => {
      const row = prefsRows?.find(p => p.traveler_id === ctx.id)
      const base: MemberFlightPrefs = row
        ? {
            direct_preference: row.direct_preference,
            preferred_airlines: row.preferred_airlines || [],
            avoid_airlines: row.avoid_airlines || [],
            cost_vs_time: row.cost_vs_time,
            wants_group_routing: row.wants_group_routing,
            notes: row.notes,
          }
        : defaultMemberPrefs(ctx)
      return { ...base, traveler_id: ctx.id, traveler_name: ctx.name }
    })

    const analysis = await analyzeFlightScenarios({
      trip: {
        name: trip.name,
        destination: trip.destination,
        locked_tier: trip.locked_tier,
        date_range_start: trip.date_range_start,
        date_range_end: trip.date_range_end,
        start_date: trip.start_date,
        end_date: trip.end_date,
        locked_date_start: trip.locked_date_start,
        locked_date_end: trip.locked_date_end,
      },
      coordination_mode: session.coordination_mode as CoordinationMode,
      mix_notes: session.mix_notes,
      vote_estimate_per_person: session.vote_estimate_per_person,
      travelers: contexts,
      member_prefs,
    })

    await supabase
      .from('trip_flight_sessions')
      .update({
        status: 'review',
        analysis,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    return NextResponse.json({ analysis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
