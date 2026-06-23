import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { findTravelerForUser } from '@/lib/traveler-lookup'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { ensureVotingKickoff } from '@/lib/voting/kickoff'

/** Force-sync brainstorm picks → destination_analysis and start voting if ready. */
export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()
    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const userClient = supabaseFromRequest(request)
    const user = await requireUser(userClient)
    const traveler = await findTravelerForUser(userClient, tripId, user.id)
    if (!traveler) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const db = tryCreateAdminClient() ?? userClient
    const result = await ensureVotingKickoff(db, tripId)

    if (!result) {
      return NextResponse.json(
        { error: 'Not everyone has submitted their card choices yet, or no destinations were found.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
