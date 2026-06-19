import { NextRequest, NextResponse } from 'next/server'

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import type { ItineraryData } from '@/lib/bookings/types'
import {
  insertInspirationIntoItinerary,
  type TripInspirationRow,
} from '@/lib/trip-companion/merge-inspirations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)
    const { inspirationId } = await request.json()

    if (!inspirationId) {
      return NextResponse.json({ error: 'inspirationId required' }, { status: 400 })
    }

    const { data: inspiration, error: inspError } = await supabase
      .from('trip_inspirations')
      .select('*')
      .eq('id', inspirationId)
      .eq('trip_id', tripId)
      .single()

    if (inspError || !inspiration) {
      return NextResponse.json({ error: 'Saved place not found' }, { status: 404 })
    }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const fallbackDate =
      trip.locked_date_start ||
      trip.start_date ||
      new Date().toISOString().slice(0, 10)

    const base: ItineraryData = (trip.options as { itinerary?: ItineraryData })?.itinerary || {
      summary: 'Your trip',
      days: [],
    }

    const merged = insertInspirationIntoItinerary(
      base,
      inspiration as TripInspirationRow,
      fallbackDate
    )

    const mergedOptions = { ...(trip.options || {}), itinerary: merged }

    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)

    await supabase
      .from('trip_inspirations')
      .update({ status: 'added_to_itinerary', updated_at: new Date().toISOString() })
      .eq('id', inspirationId)

    return NextResponse.json({ itinerary: merged, inspirationId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
