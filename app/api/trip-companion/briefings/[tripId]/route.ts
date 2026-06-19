import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { buildCompanionContext, mergeCompanionOptions } from '@/lib/trip-companion/client-api'
import { generateDayBriefings } from '@/lib/trip-companion/generate-briefing'
import type { TripBooking } from '@/lib/bookings/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data: trip } = await supabase.from('trips').select('options').eq('id', tripId).single()
    const briefings = (trip?.options as { companion?: { briefings?: Record<string, unknown> } })?.companion?.briefings || {}
    return NextResponse.json({ briefings })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)
    const { date, mode = 'both' } = await request.json()

    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const { data: bookings } = await supabase.from('trip_bookings').select('*').eq('trip_id', tripId)
    const ctx = buildCompanionContext({
      trip,
      bookings: (bookings || []) as TripBooking[],
      travelerNationalities: ['United States'],
    })

    const briefings = await generateDayBriefings(ctx, date, mode)
    const mergedOptions = mergeCompanionOptions(trip.options as Record<string, unknown>, {
      briefings: { [date]: briefings },
    })
    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)

    return NextResponse.json({ briefings })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
