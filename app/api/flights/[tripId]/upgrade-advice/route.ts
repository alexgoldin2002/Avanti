import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import { buildFlightTravelerContexts } from '@/lib/flights/traveler-context'
import { buildUpgradeAdvice } from '@/lib/flights/upgrade-advisor'
import type { FlightAnalysis, FlightOption } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { optionId } = (await request.json()) as { optionId?: string }
    const supabase = adminOrAnon(request)

    const { data: trip } = await supabase.from('trips').select('destination').eq('id', tripId).single()
    if (!trip?.destination) {
      return NextResponse.json({ error: 'Destination required' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('analysis, locked_summary')
      .eq('trip_id', tripId)
      .maybeSingle()

    const analysis = session?.analysis as FlightAnalysis | null
    let flight: FlightOption | null = null

    if (optionId) {
      flight = analysis?.flight_options?.find(o => o.id === optionId) ?? null
    }
    if (!flight && analysis?.flight_options?.length) {
      flight = analysis.flight_options.find(o => o.recommended) ?? analysis.flight_options[0]
    }

    const travelers = await buildFlightTravelerContexts(supabase, tripId)
    const advice = await buildUpgradeAdvice({
      travelers,
      flight,
      destination: trip.destination,
    })

    return NextResponse.json({ advice })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
