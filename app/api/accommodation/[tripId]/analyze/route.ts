import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 300

import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { analyzeStayOptions } from '@/lib/accommodation/analyze-core'
import {
  buildStayTravelerContexts,
  defaultMemberStayPrefs,
} from '@/lib/accommodation/traveler-context'
import type { MemberStayPrefs, StayCoordinationMode } from '@/lib/accommodation/types'

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
    if (!trip.flights_locked) {
      return NextResponse.json({ error: 'Lock flights first' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('trip_accommodation_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!session?.coordination_mode) {
      return NextResponse.json({ error: 'Set coordination mode first' }, { status: 400 })
    }

    await supabase
      .from('trip_accommodation_sessions')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', session.id)

    const { data: prefsRows } = await supabase
      .from('trip_accommodation_member_prefs')
      .select('*')
      .eq('session_id', session.id)

    const contexts = await buildStayTravelerContexts(supabase, tripId)
    const member_prefs = contexts.map(ctx => {
      const row = prefsRows?.find(p => p.traveler_id === ctx.id)
      const base: MemberStayPrefs = row
        ? {
            stay_type: row.stay_type,
            private_room: row.private_room,
            shared_space_ok: row.shared_space_ok,
            max_budget_per_night: row.max_budget_per_night,
            neighborhood_notes: row.neighborhood_notes,
            amenities: row.amenities || [],
            notes: row.notes,
          }
        : defaultMemberStayPrefs(ctx)
      return { ...base, traveler_id: ctx.id, traveler_name: ctx.name }
    })

    const { count } = await supabase
      .from('travelers')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)

    const analysis = await analyzeStayOptions({
      trip_id: tripId,
      trip: {
        name: trip.name,
        destination: trip.destination,
        locked_tier: trip.locked_tier,
        locked_date_start: trip.locked_date_start,
        locked_date_end: trip.locked_date_end,
        start_date: trip.start_date,
        end_date: trip.end_date,
      },
      coordination_mode: session.coordination_mode as StayCoordinationMode,
      mix_notes: session.mix_notes,
      vote_estimate_per_night: session.vote_estimate_per_night,
      guest_count: Math.max(1, count || 2),
      travelers: contexts,
      member_prefs,
    })

    await supabase
      .from('trip_accommodation_sessions')
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
    return NextResponse.json({ error: msg }, { status })
  }
}
