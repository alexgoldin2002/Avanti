import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import {
  upsertAccountCompanion,
  createManagedTripTraveler,
  type CompanionInput,
} from '@/lib/account-companions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const body = (await request.json()) as {
      companion?: CompanionInput & { id?: string }
      savedCompanionId?: string
    }

    const { data: trip } = await userClient.from('trips').select('organizer_id').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const isOrganizer = trip.organizer_id === user.id
    const { data: myTraveler } = await userClient
      .from('travelers')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isOrganizer && !myTraveler) {
      return NextResponse.json({ error: 'You must be on this trip to add travelers' }, { status: 403 })
    }

    const db = tryCreateAdminClient() ?? userClient

    let companion
    if (body.savedCompanionId) {
      const { data: saved, error } = await db
        .from('account_companions')
        .select('*')
        .eq('id', body.savedCompanionId)
        .eq('owner_user_id', user.id)
        .single()
      if (error || !saved) {
        return NextResponse.json({ error: 'Saved traveler not found' }, { status: 404 })
      }
      companion = saved
    } else if (body.companion?.full_name?.trim()) {
      companion = await upsertAccountCompanion(db, user.id, body.companion)
    } else {
      return NextResponse.json({ error: 'full_name required' }, { status: 400 })
    }

    const traveler = await createManagedTripTraveler(db, {
      tripId,
      managerUserId: user.id,
      companion,
    })

    return NextResponse.json({ ok: true, companion, traveler })
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : 'Could not add traveler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
