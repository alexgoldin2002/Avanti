import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { openBrainstormTimestamps } from '@/lib/trip-phases/finalize'

/** Organizer closes invites and unlocks planning (no voting flow). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const now = new Date()
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { error } = await supabase
      .from('trips')
      .update(openBrainstormTimestamps(trip || {}, now))
      .eq('id', tripId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
