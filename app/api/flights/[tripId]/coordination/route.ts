import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import type { CoordinationMode } from '@/lib/flights/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { mode, mixNotes } = (await request.json()) as {
      mode: CoordinationMode
      mixNotes?: string
    }

    if (!['together', 'independent', 'mix'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid coordination mode' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_flight_sessions')
      .select('id')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const now = new Date().toISOString()
    await supabase
      .from('trip_flight_sessions')
      .update({
        coordination_mode: mode,
        mix_notes: mixNotes || null,
        status: 'preferences',
        updated_at: now,
      })
      .eq('id', session.id)

    return NextResponse.json({ ok: true, status: 'preferences' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
