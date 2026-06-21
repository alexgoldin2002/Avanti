import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import type { FlightAnalysis, FlightScenario } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { scenarioId } = await request.json()
    if (!scenarioId) return NextResponse.json({ error: 'scenarioId required' }, { status: 400 })

    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const analysis = session.analysis as FlightAnalysis | null
    const scenario = analysis?.scenarios?.find((s: FlightScenario) => s.id === scenarioId)
    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })

    const now = new Date().toISOString()

    await supabase
      .from('trip_flight_sessions')
      .update({
        status: 'locked',
        selected_scenario_id: scenarioId,
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
