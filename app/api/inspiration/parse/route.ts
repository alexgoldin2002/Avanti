import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { parseInspiration } from '@/lib/trip-companion/parse-inspiration'
import type { ItineraryData } from '@/lib/bookings/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { tripId, url, caption, imageBase64, mimeType } = await request.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    if (!url && !imageBase64 && !caption) {
      return NextResponse.json({ error: 'Provide a link, screenshot, or caption' }, { status: 400 })
    }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const itinerary = (trip.options as { itinerary?: ItineraryData })?.itinerary || null

    const parsed = await parseInspiration({
      url,
      caption,
      imageBase64,
      mimeType,
      tripDestination: trip.destination || 'Unknown',
      tripStart: trip.locked_date_start || trip.start_date || '',
      tripEnd: trip.locked_date_end || trip.end_date || '',
      itinerary,
    })

    return NextResponse.json({ parsed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
