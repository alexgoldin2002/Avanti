import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { extendPhaseDeadline } from '@/lib/trip-phases/finalize'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { phase, extraMinutes } = await request.json()
    if (!phase || typeof extraMinutes !== 'number') {
      return NextResponse.json({ error: 'phase and extraMinutes required' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const db = tryCreateAdminClient() ?? userClient

    const newDeadline = await extendPhaseDeadline(db, tripId, phase, extraMinutes)
    return NextResponse.json({ ok: true, deadlineAt: newDeadline })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 400
    return NextResponse.json({ error: msg }, { status: status === 400 ? 400 : status })
  }
}
