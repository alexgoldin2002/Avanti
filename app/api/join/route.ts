import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import {
  upsertAccountCompanion,
  createManagedTripTraveler,
  type CompanionInput,
} from '@/lib/account-companions'

type JoinCompanion = CompanionInput & { savedCompanionId?: string }

function tripAcceptsJoins(trip: {
  invite_code: string | null
  invites_closed?: boolean | null
  invite_locked?: boolean | null
}) {
  return (
    !!trip.invite_code &&
    !trip.invites_closed &&
    !trip.invite_locked
  )
}

function joinClosedReason(trip: {
  invites_closed?: boolean | null
  invite_locked?: boolean | null
}) {
  if (trip.invites_closed) return 'This trip is no longer accepting new guests.'
  if (trip.invite_locked) {
    return 'The organizer is finalizing trip settings — new joins are paused for now.'
  }
  return 'This trip is no longer accepting new members.'
}

export async function POST(request: NextRequest) {
  try {
    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const body = (await request.json()) as {
      inviteCode?: string
      nickname?: string
      companions?: JoinCompanion[]
    }

    const inviteCode = body.inviteCode?.trim()
    if (!inviteCode) {
      return NextResponse.json({ error: 'Missing invite code' }, { status: 400 })
    }

    const db = tryCreateAdminClient() ?? userClient

    const { data: trip, error: tripError } = await db
      .from('trips')
      .select('id, name, invite_code, invites_closed, invite_locked')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
    }

    if (!tripAcceptsJoins(trip)) {
      return NextResponse.json({ error: joinClosedReason(trip) }, { status: 403 })
    }

    const { data: profile } = await db
      .from('user_profiles')
      .select('full_name, email, profile_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: existing } = await db
      .from('travelers')
      .select('id, status')
      .eq('trip_id', trip.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      const { error: insertError } = await db.from('travelers').insert({
        trip_id: trip.id,
        full_name: profile?.full_name || '',
        email: profile?.email || user.email || '',
        nickname: body.nickname?.trim() || profile?.full_name?.split(' ')[0] || '',
        role: 'member',
        profile_complete: !!profile?.profile_complete,
        status: 'pending',
        user_id: user.id,
      })
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    for (const item of body.companions || []) {
      let companion
      if (item.savedCompanionId) {
        const { data: saved, error } = await db
          .from('account_companions')
          .select('*')
          .eq('id', item.savedCompanionId)
          .eq('owner_user_id', user.id)
          .single()
        if (error || !saved) {
          return NextResponse.json({ error: 'Saved traveler not found' }, { status: 404 })
        }
        companion = saved
      } else if (item.full_name?.trim()) {
        companion = await upsertAccountCompanion(db, user.id, item)
      } else {
        continue
      }

      await createManagedTripTraveler(db, {
        tripId: trip.id,
        managerUserId: user.id,
        companion,
      })
    }

    return NextResponse.json({
      ok: true,
      tripId: trip.id,
      tripName: trip.name,
      status: existing?.status || 'pending',
    })
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : 'Could not join trip'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
