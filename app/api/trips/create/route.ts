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

function buildTripRow(body: CreateTripBody, organizerId: string) {
  return {
    name: body.name.trim(),
    trip_type: body.trip_type.trim(),
    destination: body.destination ?? 'TBD',
    destination_type: body.destination_type ?? 'flexible',
    date_type: body.date_type ?? 'flexible',
    cover_color: body.cover_color ?? 'oklch(0.22 0.04 150)',
    organizer_id: organizerId,
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
}

function buildTravelerRow(
  tripId: string,
  userId: string,
  userEmail: string | undefined,
  traveler: CreateTripBody['traveler'],
) {
  return {
    trip_id: tripId,
    user_id: userId,
    full_name: traveler?.full_name || '',
    email: traveler?.email || userEmail || '',
    nickname: traveler?.nickname || traveler?.full_name?.split(' ')[0] || '',
    role: 'organizer',
    profile_complete: traveler?.profile_complete ?? true,
  }
}

async function createViaRpc(userClient: ReturnType<typeof supabaseFromRequest>, body: CreateTripBody) {
  const { data, error } = await userClient.rpc('create_trip_for_organizer', {
    p_payload: body,
  })
  if (error) return { trip: null, error }
  const trip = (data as { trip?: Record<string, unknown> } | null)?.trip ?? null
  return { trip, error: trip ? null : { message: 'Failed to create trip' } }
}

async function createViaAdmin(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  body: CreateTripBody,
  userId: string,
  userEmail: string | undefined,
) {
  const tripData = buildTripRow(body, userId)
  const { data: trip, error: tripError } = await admin
    .from('trips')
    .insert(tripData)
    .select()
    .single()

  if (tripError || !trip) {
    return { trip: null, error: tripError ?? { message: 'Failed to create trip' } }
  }

  const { error: travelerError } = await admin
    .from('travelers')
    .insert(buildTravelerRow(trip.id, userId, userEmail, body.traveler))

  if (travelerError) {
    await admin.from('trips').delete().eq('id', trip.id)
    return { trip: null, error: travelerError }
  }

  return { trip, error: null }
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

    const admin = tryCreateAdminClient()
    const rpcResult = await createViaRpc(userClient, { ...body, name, trip_type: tripType })

    if (rpcResult.trip) {
      return NextResponse.json({ trip: rpcResult.trip })
    }

    const rpcMissing =
      rpcResult.error?.message?.includes('create_trip_for_organizer') ||
      rpcResult.error?.code === 'PGRST202'

    if (!rpcMissing && rpcResult.error) {
      return NextResponse.json({ error: rpcResult.error.message }, { status: 500 })
    }

    if (!admin) {
      return NextResponse.json(
        {
          error:
            'Trip creation is not fully configured yet. Run the latest Supabase migrations (create_trip_for_organizer).',
        },
        { status: 503 },
      )
    }

    const adminResult = await createViaAdmin(admin, { ...body, name, trip_type: tripType }, user.id, user.email)
    if (adminResult.error || !adminResult.trip) {
      return NextResponse.json(
        { error: adminResult.error?.message || 'Failed to create trip' },
        { status: 500 },
      )
    }

    return NextResponse.json({ trip: adminResult.trip })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
