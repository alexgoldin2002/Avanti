import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'
import type { MemberStayPrefs } from '@/lib/accommodation/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = (await request.json()) as Partial<MemberStayPrefs>

    const supabase = adminOrAnon(request)

    const { data: session } = await supabase
      .from('trip_accommodation_sessions')
      .select('id')
      .eq('trip_id', tripId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()

    const me = travelers?.find(
      t => t.user_id === user.id || t.email?.toLowerCase() === profile?.email?.toLowerCase()
    )
    if (!me) return NextResponse.json({ error: 'Not a trip member' }, { status: 403 })

    const now = new Date().toISOString()
    const row = {
      session_id: session.id,
      traveler_id: me.id,
      user_id: user.id,
      stay_type: body.stay_type || 'any',
      private_room: body.private_room ?? true,
      shared_space_ok: body.shared_space_ok ?? true,
      max_budget_per_night: body.max_budget_per_night ?? null,
      neighborhood_notes: body.neighborhood_notes ?? null,
      amenities: body.amenities || [],
      notes: body.notes ?? null,
      updated_at: now,
    }

    await supabase
      .from('trip_accommodation_member_prefs')
      .upsert(row, { onConflict: 'session_id,traveler_id' })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
