import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { generateAndSavePersonalContent } from '@/lib/voting/personalized-content'

export async function POST(request: NextRequest) {
  try {
    const { tripId, destinationAnalysisId } = await request.json()
    if (!tripId || !destinationAnalysisId) {
      return NextResponse.json({ error: 'tripId and destinationAnalysisId required' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const traveler = await findTravelerForUser(userClient, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? userClient

    const { data: destination } = await userClient
      .from('destination_analysis')
      .select('id, destination_name, card_snapshot, advanced_to_round_two')
      .eq('id', destinationAnalysisId)
      .eq('trip_id', tripId)
      .single()

    if (!destination?.advanced_to_round_two) {
      return NextResponse.json({ error: 'Destination not in Round 2' }, { status: 400 })
    }

    const { data: travelerFull } = await userClient
      .from('travelers')
      .select('step2')
      .eq('id', traveler.id)
      .single()

    const { data: trip } = await userClient
      .from('trips')
      .select('start_date, end_date')
      .eq('id', tripId)
      .single()

    const content = await generateAndSavePersonalContent(db, {
      tripId,
      travelerId: traveler.id,
      destinationAnalysisId,
      destinationName: destination.destination_name,
      cardSnapshot: (destination.card_snapshot || null) as Record<string, unknown> | null,
      step2: (travelerFull?.step2 || traveler.step2 || {}) as Record<string, unknown>,
      travelDatesLabel:
        trip?.start_date && trip?.end_date
          ? `${trip.start_date} to ${trip.end_date}`
          : undefined,
    })

    return NextResponse.json({ content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
