import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import type { StayAnalysis, StayOption } from '@/lib/accommodation/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const { optionId } = await request.json()
    if (!optionId) {
      return NextResponse.json({ error: 'optionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_accommodation_sessions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const analysis = session.analysis as StayAnalysis | null
    const option = analysis?.stay_options?.find((o: StayOption) => o.id === optionId)
    if (!option) return NextResponse.json({ error: 'Stay option not found' }, { status: 404 })

    const now = new Date().toISOString()

    await supabase
      .from('trip_accommodation_sessions')
      .update({
        status: 'locked',
        selected_option_id: option.id,
        locked_at: now,
        locked_summary: option,
        updated_at: now,
      })
      .eq('id', session.id)

    await supabase
      .from('trips')
      .update({
        accommodation_locked: true,
        accommodation_locked_at: now,
      })
      .eq('id', tripId)

    return NextResponse.json({ ok: true, option })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = adminOrAnon(request)
    await requireOrganizer(supabase, tripId)

    const { data: session } = await supabase
      .from('trip_accommodation_sessions')
      .select('id')
      .eq('trip_id', tripId)
      .single()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const now = new Date().toISOString()

    await supabase
      .from('trip_accommodation_sessions')
      .update({
        status: 'review',
        selected_option_id: null,
        locked_at: null,
        locked_summary: null,
        updated_at: now,
      })
      .eq('id', session.id)

    await supabase
      .from('trips')
      .update({
        accommodation_locked: false,
        accommodation_locked_at: null,
      })
      .eq('id', tripId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
