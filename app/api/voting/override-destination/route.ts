import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { applyDestinationOverride } from '@/lib/voting'

export async function POST(request: NextRequest) {
  try {
    const { tripId, destinationAnalysisId, destinationName } = await request.json()
    if (!tripId) {
      return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    }
    if (!destinationAnalysisId && !destinationName?.trim()) {
      return NextResponse.json({ error: 'Pick a destination or enter a name' }, { status: 400 })
    }

    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)

    const { data: trip } = await supabase
      .from('trips')
      .select('organizer_id')
      .eq('id', tripId)
      .single()

    if (!trip || trip.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Only the trip organizer can override' }, { status: 403 })
    }

    await applyDestinationOverride(supabase, tripId, {
      destinationAnalysisId: destinationAnalysisId || undefined,
      destinationName: destinationName?.trim() || undefined,
    })

    const { data: updated } = await supabase
      .from('trips')
      .select('id, name, destination, winning_destination_id')
      .eq('id', tripId)
      .single()

    return NextResponse.json({ ok: true, trip: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
