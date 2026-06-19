import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { buildCompanionContext, mergeCompanionOptions } from '@/lib/trip-companion/client-api'
import { generateDestinationEssentials } from '@/lib/trip-companion/generate-essentials'
import type { TripBooking } from '@/lib/bookings/types'

async function loadCompanionInputs(supabase: ReturnType<typeof supabaseFromRequest>, tripId: string) {
  const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (!trip) return null

  const { data: bookings } = await supabase.from('trip_bookings').select('*').eq('trip_id', tripId)
  const { data: travelers } = await supabase.from('travelers').select('user_id').eq('trip_id', tripId)

  const userIds = (travelers || []).map(t => t.user_id).filter(Boolean)
  let nationalities = ['United States']

  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('country_of_residence')
      .in('user_id', userIds)
    const fromProfiles = (profiles || []).map(p => p.country_of_residence).filter(Boolean)
    if (fromProfiles.length) nationalities = [...new Set(fromProfiles)]
  }

  return {
    trip,
    ctx: buildCompanionContext({
      trip,
      bookings: (bookings || []) as TripBooking[],
      travelerNationalities: nationalities,
    }),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const loaded = await loadCompanionInputs(supabase, tripId)
    if (!loaded) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const companion = (loaded.trip.options as { companion?: Record<string, unknown> })?.companion || {}
    return NextResponse.json({ essentials: companion.essentials || null })
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

    const loaded = await loadCompanionInputs(supabase, tripId)
    if (!loaded) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const essentials = await generateDestinationEssentials(loaded.ctx)
    const mergedOptions = mergeCompanionOptions(loaded.trip.options as Record<string, unknown>, { essentials })

    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)

    return NextResponse.json({ essentials })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
