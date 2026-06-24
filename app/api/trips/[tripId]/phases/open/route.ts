import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { ensureVotingKickoff } from '@/lib/voting/kickoff'
import { applyRoundOneAdvancers } from '@/lib/voting/tally'
import {
  openBrainstormTimestamps,
  openRoundTwoTimestamps,
  openVotingTimestamps,
} from '@/lib/trip-phases/finalize'
import type { PhaseId } from '@/lib/trip-phases/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { phase } = (await request.json()) as { phase?: PhaseId }
    if (!phase) return NextResponse.json({ error: 'phase required' }, { status: 400 })

    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const db = tryCreateAdminClient() ?? userClient

    const { data: trip } = await db.from('trips').select('*').eq('id', tripId).single()
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const now = new Date()

    if (phase === 'brainstorm') {
      const { error } = await db
        .from('trips')
        .update(openBrainstormTimestamps(trip, now))
        .eq('id', tripId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (phase === 'round_one') {
      const kickoff = await ensureVotingKickoff(db, tripId)
      if (!kickoff) {
        return NextResponse.json(
          { error: 'Not everyone has submitted card choices yet, or no destinations were found.' },
          { status: 400 }
        )
      }
      const patch = {
        ...openVotingTimestamps(trip, now),
        brainstorm_closed_at: trip.brainstorm_closed_at ?? now.toISOString(),
      }
      const { error } = await db.from('trips').update(patch).eq('id', tripId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, ...kickoff })
    }

    if (phase === 'round_two') {
      if (trip.voting_round !== 2 && trip.voting_round !== 1) {
        return NextResponse.json({ error: 'Round 2 is not ready yet' }, { status: 400 })
      }
      if (trip.voting_round === 1) {
        await applyRoundOneAdvancers(db, tripId)
      }
      const { error } = await db
        .from('trips')
        .update({
          ...openRoundTwoTimestamps(trip, now),
          round_one_closed_at: trip.round_one_closed_at ?? now.toISOString(),
        })
        .eq('id', tripId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Cannot manually open reveal' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
