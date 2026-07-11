import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import type { FlightAnalysis, FlightOption, FlightScenario } from '@/lib/flights/types'

/** Build a scenario-compatible locked summary from a Google-Flights-style option. */
function optionToLockedSummary(opt: FlightOption): FlightScenario {
  const memberCount = opt.member_breakdown?.length || 1
  return {
    id: opt.id,
    label: opt.airlines.join(' · ') || 'Selected flight',
    departure_date: opt.departure_date,
    return_date: opt.return_date,
    total_group_cost_usd: opt.price_usd * memberCount,
    avg_per_person_usd: opt.price_usd,
    cost_vs_vote_estimate_pct: null,
    cost_vs_time_label: opt.stops_label,
    recommended: opt.recommended,
    group_size_note: null,
    solo_vs_group_delta_usd: null,
    cheapest_date_window: null,
    routing_order_note: opt.layover_detail || null,
    member_plans: [],
    group_sync: {
      first_arrival: opt.arrive_time,
      last_arrival: opt.arrive_time,
      spread_hours: 0,
      meetup_options: [],
      everyone_same_day: true,
    },
    pros: opt.pros,
    cons: opt.cons,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { scenarioId, optionId } = await request.json()
    if (!scenarioId && !optionId) {
      return NextResponse.json({ error: 'scenarioId or optionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const analysis = session.analysis as FlightAnalysis | null
    let scenario: FlightScenario | undefined
    if (optionId) {
      const opt = analysis?.flight_options?.find((o: FlightOption) => o.id === optionId)
      if (!opt) return NextResponse.json({ error: 'Flight option not found' }, { status: 404 })
      scenario = optionToLockedSummary(opt)
    } else {
      scenario = analysis?.scenarios?.find((s: FlightScenario) => s.id === scenarioId)
    }
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })

    const now = new Date().toISOString()

    await supabase
      .from('trip_flight_sessions')
      .update({
        status: 'locked',
        selected_scenario_id: scenario.id,
        locked_at: now,
        locked_summary: scenario,
        updated_at: now,
      })
      .eq('id', session.id)

    await supabase
      .from('trips')
      .update({
        flights_locked: true,
        flights_locked_at: now,
        locked_date_start: scenario.departure_date,
        locked_date_end: scenario.return_date,
        dates_locked: true,
        start_date: scenario.departure_date,
        end_date: scenario.return_date,
      })
      .eq('id', tripId)

    return NextResponse.json({
      ok: true,
      departureDate: scenario.departure_date,
      returnDate: scenario.return_date,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

/** Reopen flight selection: revert a locked session back to the results stage. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('id, analysis')
      .eq('trip_id', tripId)
      .single()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const now = new Date().toISOString()

    await supabase
      .from('trip_flight_sessions')
      .update({
        status: 'review',
        selected_scenario_id: null,
        locked_at: null,
        locked_summary: null,
        updated_at: now,
      })
      .eq('id', session.id)

    await supabase
      .from('trips')
      .update({
        flights_locked: false,
        flights_locked_at: null,
        dates_locked: false,
      })
      .eq('id', tripId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
