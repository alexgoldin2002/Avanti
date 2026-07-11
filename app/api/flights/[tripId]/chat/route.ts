import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 120

import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import { buildFlightTravelerContexts, defaultMemberPrefs } from '@/lib/flights/traveler-context'
import { runFlightChat, type FlightChatMessage } from '@/lib/flights/chat'
import type { CoordinationMode, FlightAnalysis, FlightOption } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = (await request.json()) as {
      messages?: FlightChatMessage[]
      currentOptions?: FlightOption[]
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : []
    if (messages.length === 0) {
      return NextResponse.json({ error: 'No message' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip?.destination || trip.destination === 'TBD') {
      return NextResponse.json({ error: 'Lock destination first' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle()

    const analysis = session?.analysis as FlightAnalysis | null
    const currentOptions =
      body.currentOptions && body.currentOptions.length > 0
        ? body.currentOptions
        : analysis?.flight_options || []

    const contexts = await buildFlightTravelerContexts(supabase, tripId)

    const result = await runFlightChat(
      {
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
          group_overlap_start: trip.group_overlap_start,
          group_overlap_end: trip.group_overlap_end,
          group_overlap_nights: trip.group_overlap_nights,
        },
        coordination_mode: (session?.coordination_mode as CoordinationMode) || 'independent',
        mix_notes: session?.mix_notes ?? null,
        vote_estimate_per_person: session?.vote_estimate_per_person ?? null,
        travelers: contexts,
        member_prefs: contexts.map(ctx => ({
          ...defaultMemberPrefs(ctx),
          traveler_id: ctx.id,
          traveler_name: ctx.name,
        })),
      },
      currentOptions,
      messages,
    )

    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
