import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { buildCompanionContext, mergeCompanionOptions } from '@/lib/trip-companion/client-api'
import { generateCountryApps } from '@/lib/trip-companion/generate-country-apps'
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
    const companion = (trip?.options as { companion?: Record<string, unknown> })?.companion || {}
    return NextResponse.json({ country_apps: companion.country_apps || null })
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

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const { data: bookings } = await supabase.from('trip_bookings').select('*').eq('trip_id', tripId)
    const ctx = buildCompanionContext({
      trip,
      bookings: (bookings || []) as TripBooking[],
      travelerNationalities: ['United States'],
    })

    const country_apps = await generateCountryApps(ctx)
    const mergedOptions = mergeCompanionOptions(trip.options as Record<string, unknown>, { country_apps })
    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)

    return NextResponse.json({ country_apps })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
