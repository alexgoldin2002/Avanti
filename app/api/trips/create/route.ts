import { NextRequest, NextResponse } from 'next/server'
import { requireUser, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

type CreateTripBody = {
  name: string
  trip_type: string
  destination?: string
  destination_type?: string
  date_type?: string
  cover_color?: string
  status?: string
  is_event_centered?: boolean
  event_name?: string | null
  event_date?: string | null
  event_date_end?: string | null
  event_location?: string | null
  traveler?: {
    full_name?: string
    email?: string
    nickname?: string
    profile_complete?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)

    const body = (await request.json()) as CreateTripBody
    const name = body.name?.trim()
    const tripType = body.trip_type?.trim()
    if (!name || !tripType) {
      return NextResponse.json({ error: 'Trip name and group type are required' }, { status: 400 })
    }

    const tripData = {
      name,
      trip_type: tripType,
      destination: body.destination ?? 'TBD',
      destination_type: body.destination_type ?? 'flexible',
      date_type: body.date_type ?? 'flexible',
      cover_color: body.cover_color ?? 'oklch(0.22 0.04 150)',
      organizer_id: user.id,
      status: body.status ?? 'planning',
      is_event_centered: body.is_event_centered ?? false,
      ...(body.is_event_centered
        ? {
            event_name: body.event_name ?? null,
            event_date: body.event_date ?? null,
            event_date_end: body.event_date_end ?? null,
            event_location: body.event_location ?? null,
          }
        : {}),
    }

    const db = tryCreateAdminClient() ?? userClient
    const { data: trip, error: tripError } = await db
      .from('trips')
      .insert(tripData)
      .select()
      .single()

    if (tripError || !trip) {
      return NextResponse.json(
        { error: tripError?.message || 'Failed to create trip' },
        { status: 500 },
      )
    }

    const traveler = body.traveler ?? {}
    const { error: travelerError } = await db.from('travelers').insert({
      trip_id: trip.id,
      user_id: user.id,
      full_name: traveler.full_name || '',
      email: traveler.email || user.email || '',
      nickname: traveler.nickname || traveler.full_name?.split(' ')[0] || '',
      role: 'organizer',
      profile_complete: traveler.profile_complete ?? true,
    })

    if (travelerError) {
      await db.from('trips').delete().eq('id', trip.id)
      return NextResponse.json({ error: travelerError.message }, { status: 500 })
    }

    return NextResponse.json({ trip })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
